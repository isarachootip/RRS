import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@rrs/db";
import { createAuditExtension } from "../audit/prisma-audit.extension";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    const extended = this.$extends(createAuditExtension(this));
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          prop in extended &&
          typeof prop === "string" &&
          !prop.startsWith("$on") &&
          prop !== "$connect" &&
          prop !== "$disconnect"
        ) {
          const val = Reflect.get(extended, prop, extended);
          return typeof val === "function" ? val.bind(extended) : val;
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === "function" ? val.bind(target) : val;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
