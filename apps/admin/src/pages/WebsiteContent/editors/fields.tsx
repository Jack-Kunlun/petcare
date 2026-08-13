import type { WebsiteActionLink } from "@petcare/shared-types";

export const inputClassName =
  "mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-100";

export const textareaClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 disabled:cursor-not-allowed disabled:bg-slate-100";

interface TextFieldProps {
  label: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}

/** Renders one labelled plain-text Website Content field. */
export function TextField({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
  multiline = false,
  rows = 3,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value}
          disabled={disabled}
          required={required}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          className={textareaClassName}
        />
      ) : (
        <input
          aria-label={label}
          value={value}
          disabled={disabled}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        />
      )}
    </label>
  );
}

interface SelectFieldProps<TValue extends string | number> {
  label: string;
  value: TValue;
  options: readonly { value: TValue; label: string }[];
  onChange(value: TValue): void;
  disabled?: boolean;
}

/** Renders a bounded option field so editors never submit arbitrary display settings. */
export function SelectField<TValue extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectFieldProps<TValue>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <select
        aria-label={label}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find((option) => String(option.value) === event.target.value);

          if (next) {
            onChange(next.value);
          }
        }}
        className={inputClassName}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface CheckboxFieldProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
}

/** Renders one accessible boolean Website Content setting. */
export function CheckboxField({ label, checked, onChange, disabled = false }: CheckboxFieldProps) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
      />
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </label>
  );
}

interface ActionLinkFieldsProps {
  label: string;
  value: WebsiteActionLink | null;
  onChange(value: WebsiteActionLink | null): void;
  disabled?: boolean;
  required?: boolean;
}

/** Edits one allow-listed Website action without providing arbitrary HTML controls. */
export function ActionLinkFields({
  label,
  value,
  onChange,
  disabled = false,
  required = false,
}: ActionLinkFieldsProps) {
  if (value === null && !required) {
    return (
      <CheckboxField
        label={`启用${label}`}
        checked={false}
        disabled={disabled}
        onChange={(checked) => onChange(checked ? { label: "", href: "/" } : null)}
      />
    );
  }

  const action = value ?? { label: "", href: "/" };

  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{label}</legend>
      {!required ? (
        <CheckboxField
          label={`启用${label}`}
          checked={value !== null}
          disabled={disabled}
          onChange={(checked) => onChange(checked ? action : null)}
        />
      ) : null}
      {value !== null || required ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField
            label={`${label}文案`}
            value={action.label}
            disabled={disabled}
            required
            onChange={(next) => onChange({ ...action, label: next })}
          />
          <TextField
            label={`${label}链接`}
            value={action.href}
            disabled={disabled}
            required
            onChange={(next) => onChange({ ...action, href: next as WebsiteActionLink["href"] })}
          />
        </div>
      ) : null}
    </fieldset>
  );
}
