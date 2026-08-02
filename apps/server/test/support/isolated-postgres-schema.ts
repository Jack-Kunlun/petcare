interface IsolatedPostgresSchemaLifecycleOptions {
  schemaName: string;
  environment: NodeJS.ProcessEnv;
  overrides: NodeJS.ProcessEnv;
  initialize: () => Promise<unknown>;
  close: () => Promise<unknown>;
  drop: (schemaName: string) => Promise<unknown>;
}

function assertDisposableSchema(schemaName: string): void {
  if (!/^system_settings_e2e_\d+_\d+$/u.test(schemaName) || schemaName === "public") {
    throw new Error("System settings E2E requires an isolated disposable schema");
  }
}

/** 构造仅允许系统设置 E2E 临时 schema 的幂等删除语句。 */
export function buildDropSchemaIfExistsStatement(schemaName: string): string {
  assertDisposableSchema(schemaName);
  return `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`;
}

/** 管理系统设置 E2E 临时 schema 与进程环境的完整 setup/teardown 生命周期。 */
export class IsolatedPostgresSchemaLifecycle {
  private readonly originalEnvironment = new Map<string, string | undefined>();
  private environmentApplied = false;
  private cleanupComplete = false;

  constructor(private readonly options: IsolatedPostgresSchemaLifecycleOptions) {
    assertDisposableSchema(options.schemaName);
  }

  /** 应用隔离环境并初始化临时 schema；失败时立即执行完整清理。 */
  async setup(): Promise<void> {
    this.applyEnvironment();

    try {
      await this.options.initialize();
    } catch (error) {
      await this.cleanup(error);
    }
  }

  /** 关闭应用、幂等删除临时 schema 并恢复全部被覆盖的环境变量。 */
  async teardown(): Promise<void> {
    await this.cleanup();
  }

  private applyEnvironment(): void {
    if (this.environmentApplied) {
      return;
    }

    const overrides = { ...this.options.overrides, DB_SCHEMA: this.options.schemaName };

    for (const [key, value] of Object.entries(overrides)) {
      this.originalEnvironment.set(key, this.options.environment[key]);

      if (value === undefined) {
        delete this.options.environment[key];
      } else {
        this.options.environment[key] = value;
      }
    }

    this.environmentApplied = true;
  }

  private restoreEnvironment(): void {
    for (const [key, value] of this.originalEnvironment) {
      if (value === undefined) {
        delete this.options.environment[key];
      } else {
        this.options.environment[key] = value;
      }
    }
  }

  private async cleanup(primaryError?: unknown): Promise<void> {
    if (this.cleanupComplete) {
      if (primaryError !== undefined) {
        throw primaryError;
      }

      return;
    }

    this.cleanupComplete = true;
    const errors = primaryError === undefined ? [] : [primaryError];

    try {
      await this.options.close();
    } catch (error) {
      errors.push(error);
    }

    try {
      await this.options.drop(this.options.schemaName);
    } catch (error) {
      errors.push(error);
    } finally {
      this.restoreEnvironment();
    }

    if (errors.length === 1) {
      throw errors[0];
    }

    if (errors.length > 1) {
      throw new AggregateError(errors, "System settings E2E lifecycle cleanup failed");
    }
  }
}
