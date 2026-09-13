import { createRequire } from "node:module";
import path from "node:path";

/** Supplies payment state only in the disposable browser-test database; never adds a runtime bypass. */
export async function settleIsolatedBountyPayment(orderId: string): Promise<void> {
  const schema = process.env.DB_SCHEMA ?? "";

  if (!/^admin_e2e_[a-z0-9_]+$/.test(schema)) {
    throw new Error("Payment fixture requires a disposable admin E2E schema");
  }

  const serverRequire = createRequire(path.resolve(process.cwd(), "../server/package.json"));
  const { ConfigService } = serverRequire("./dist/config/config.service.js");
  const { PrismaService } = serverRequire("./dist/prisma/prisma.service.js");
  const { PaymentService } = serverRequire("./dist/modules/payment/payment.service.js");
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const settings = { merchantId: "1900000001", appId: "wx1234567890abcdef" };
  const paymentConfig = { wechatPay: settings, commercialServicesEnabled: true };
  const payments = new PaymentService(prisma, paymentConfig, {
    prepay: async () => ({}),
    decodeNotification: (body: Buffer) => JSON.parse(body.toString()),
  });

  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { owner: true },
    });

    if (order.ownerId !== process.env.BOUNTY_E2E_OWNER_ID) {
      throw new Error("Unexpected fixture owner");
    }

    const openid = order.owner.openid ?? "bounty_e2e_owner_openid";

    if (!order.owner.openid) {
      await prisma.user.update({ where: { id: order.ownerId }, data: { openid } });
    }

    const created = await payments.prepay(order.ownerId, order.id);

    await payments.notify(
      Buffer.from(
        JSON.stringify({
          id: `fixture-${created.payment.paymentId}`,
          eventType: "TRANSACTION.SUCCESS",
          resource: {
            appid: settings.appId,
            mchid: settings.merchantId,
            out_trade_no: created.payment.paymentId,
            trade_type: "JSAPI",
            trade_state: "SUCCESS",
            transaction_id: created.payment.paymentId,
            success_time: new Date().toISOString(),
            amount: { total: order.amount, currency: "CNY" },
            payer: { openid },
          },
        }),
      ),
      new Headers(),
    );
  } finally {
    await prisma.$disconnect();
  }
}
