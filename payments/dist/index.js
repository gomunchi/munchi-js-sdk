"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  AppReaderStatus: () => AppReaderStatus,
  MunchiPaymentSDK: () => MunchiPaymentSDK,
  PaymentInteractionState: () => PaymentInteractionState,
  SdkPaymentStatus: () => SdkPaymentStatus,
  VERSION: () => VERSION
});
module.exports = __toCommonJS(index_exports);

// src/MunchiPaymentSDK.ts
var import_core2 = require("@munchi/core");
var import_dayjs = __toESM(require("dayjs"));

// package.json
var version = "1.0.6";

// src/error.ts
var PaymentSDKError = class _PaymentSDKError extends Error {
  code;
  rawError;
  constructor(code, message, rawError) {
    super(message);
    this.name = "PaymentSDKError";
    this.code = code;
    this.rawError = rawError;
    Object.setPrototypeOf(this, _PaymentSDKError.prototype);
  }
};

// src/types/payment.ts
var SdkPaymentStatus = /* @__PURE__ */ ((SdkPaymentStatus2) => {
  SdkPaymentStatus2["PENDING"] = "PENDING";
  SdkPaymentStatus2["SUCCESS"] = "SUCCESS";
  SdkPaymentStatus2["FAILED"] = "FAILED";
  SdkPaymentStatus2["CANCELLED"] = "CANCELLED";
  SdkPaymentStatus2["ERROR"] = "ERROR";
  return SdkPaymentStatus2;
})(SdkPaymentStatus || {});
var PaymentInteractionState = /* @__PURE__ */ ((PaymentInteractionState2) => {
  PaymentInteractionState2["IDLE"] = "IDLE";
  PaymentInteractionState2["CONNECTING"] = "CONNECTING";
  PaymentInteractionState2["REQUIRES_INPUT"] = "REQUIRES_INPUT";
  PaymentInteractionState2["PROCESSING"] = "PROCESSING";
  PaymentInteractionState2["SUCCESS"] = "SUCCESS";
  PaymentInteractionState2["FAILED"] = "FAILED";
  PaymentInteractionState2["INTERNAL_ERROR"] = "INTERNAL_ERROR";
  return PaymentInteractionState2;
})(PaymentInteractionState || {});

// src/strategies/MockStrategy.ts
var MockStrategy = class {
  async initialize() {
    console.log("[MockSDK] Initialized");
  }
  async disconnect() {
    console.log("[MockSDK] Disconnected");
  }
  async processPayment(request) {
    console.log("[MockSDK] Processing...", request);
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    return {
      success: true,
      status: "SUCCESS" /* SUCCESS */,
      orderId: request.orderRef
    };
  }
  async cancelTransaction() {
    console.log("[MockSDK] Cancelled");
    return true;
  }
};

// src/strategies/VivaStrategy.ts
var import_core = require("@munchi/core");
var VivaStrategy = class {
  constructor(axios, messaging, config) {
    this.messaging = messaging;
    this.config = config;
    this.api = new import_core.PaymentApi(void 0, "", axios);
    this.kioskApi = new import_core.KiosksApi(void 0, "", axios);
  }
  api;
  kioskApi;
  abortController = null;
  currentSessionId = null;
  async initialize() {
  }
  async disconnect() {
    this.abortController?.abort();
    this.currentSessionId = null;
  }
  async processPayment(request, onStateChange) {
    this.abortController = new AbortController();
    onStateChange("CONNECTING" /* CONNECTING */);
    const payload = {
      amount: request.amountCents,
      orderId: request.orderRef,
      orderingBusinessId: parseInt(this.config.storeId),
      currencyCode: "978",
      identityId: this.config.kioskId
    };
    try {
      const { data } = await this.api.createVivaTransactionV3(payload);
      this.currentSessionId = data.sessionId;
      if (this.abortController.signal.aborted) {
        throw new PaymentSDKError(
          "CANCELLED" /* CANCELLED */,
          "Payment cancelled during setup"
        );
      }
      onStateChange("REQUIRES_INPUT" /* REQUIRES_INPUT */);
      const result = await this.waitForPaymentCompletion(
        data.sessionId,
        request.orderRef,
        onStateChange,
        this.abortController.signal
      );
      this.currentSessionId = null;
      return result;
    } catch (err) {
      this.currentSessionId = null;
      if (err instanceof PaymentSDKError) throw err;
      throw new PaymentSDKError(
        "NETWORK_ERROR" /* NETWORK_ERROR */,
        "Failed to create Viva Intent",
        err
      );
    }
  }
  async waitForPaymentCompletion(sessionId, orderRef, onStateChange, signal) {
    const channelName = `viva.kiosk.requests.${sessionId}`;
    const eventName = "payment:status-changed";
    return new Promise((resolve, reject) => {
      let isResolved = false;
      const cleanup = () => {
        isResolved = true;
        unsubscribe();
        clearTimeout(timer);
      };
      const onAbort = () => {
        cleanup();
        reject(
          new PaymentSDKError(
            "CANCELLED" /* CANCELLED */,
            "User cancelled the operation"
          )
        );
      };
      signal.addEventListener("abort", onAbort);
      const unsubscribe = this.messaging.subscribe(
        channelName,
        eventName,
        (data) => {
          if (!isResolved) {
            cleanup();
            signal.removeEventListener("abort", onAbort);
            resolve(this.handleSuccess(data, onStateChange));
          }
        }
      );
      const timer = setTimeout(async () => {
        if (isResolved || signal.aborted) return;
        try {
          const finalResult = await this.pollOrderStatus(
            orderRef,
            this.config.storeId,
            signal
          );
          resolve(this.handleSuccess(finalResult, onStateChange));
        } catch (pollError) {
          onStateChange("FAILED" /* FAILED */);
          reject(
            new PaymentSDKError(
              "TIMEOUT" /* TIMEOUT */,
              "Payment timed out and polling failed",
              pollError
            )
          );
        } finally {
          signal.removeEventListener("abort", onAbort);
          cleanup();
        }
      }, 1e4);
    });
  }
  async pollOrderStatus(orderRef, businessId, signal) {
    const POLLING_DURATION_MS = 12e4;
    const INTERVAL_MS = 2e3;
    const startTime = Date.now();
    const deadline = startTime + POLLING_DURATION_MS;
    while (Date.now() < deadline) {
      if (signal.aborted) {
        throw new PaymentSDKError(
          "CANCELLED" /* CANCELLED */,
          "Polling aborted by user"
        );
      }
      try {
        const { data } = await this.kioskApi.getOrderStatus(
          orderRef,
          businessId
        );
        if (data.status !== import_core.SimplePaymentStatus.Pending) return data;
      } catch (error) {
        throw new Error("Payment verification failed.");
      }
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
    }
    throw new Error("Payment verification timed out.");
  }
  handleSuccess(data, onStateChange) {
    const isSuccess = data.status === import_core.SimplePaymentStatus.Success;
    onStateChange(
      isSuccess ? "SUCCESS" /* SUCCESS */ : "FAILED" /* FAILED */
    );
    return {
      success: isSuccess,
      status: isSuccess ? "SUCCESS" /* SUCCESS */ : "FAILED" /* FAILED */,
      orderId: data.orderId,
      errorCode: data.error?.code ?? "",
      errorMessage: data.error?.message ?? ""
    };
  }
  async cancelTransaction(onStateChange) {
    if (!this.currentSessionId) return false;
    onStateChange("IDLE" /* IDLE */);
    try {
      const sessionIdToCancel = this.currentSessionId;
      this.abortController?.abort();
      this.currentSessionId = null;
      await this.api.cancelTransaction({
        cashRegisterId: this.config.storeId,
        sessionId: sessionIdToCancel
      });
      return true;
    } catch (error) {
      throw new PaymentSDKError(
        "NETWORK_ERROR" /* NETWORK_ERROR */,
        "Failed to cancel Viva transaction",
        error
      );
    } finally {
      onStateChange("FAILED" /* FAILED */);
    }
  }
};

// src/MunchiPaymentSDK.ts
var MunchiPaymentSDK = class {
  strategy;
  config;
  axios;
  messaging;
  timeoutMs;
  logger;
  constructor(axios, messaging, config, options = {}) {
    this.axios = axios;
    this.messaging = messaging;
    this.config = config;
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs || 6e4;
    this.strategy = this.resolveStrategy(config);
  }
  get version() {
    return version;
  }
  resolveStrategy(config) {
    switch (config.provider) {
      case import_core2.PaymentProvider.Nets:
        return new MockStrategy();
      case import_core2.PaymentProvider.Viva:
        return new VivaStrategy(this.axios, this.messaging, config);
      default:
        return new MockStrategy();
    }
  }
  async connect() {
    await this.strategy.initialize();
  }
  async disconnect() {
    await this.strategy.disconnect();
  }
  async initiateTransaction(params, onStateChange) {
    const startTime = (0, import_dayjs.default)();
    if (params.amountCents <= 0) {
      return {
        orderId: params.orderRef,
        success: false,
        status: "ERROR" /* ERROR */,
        errorCode: "INVALID_AMOUNT" /* INVALID_AMOUNT */,
        errorMessage: "Amount must be greater than 0"
      };
    }
    try {
      const transactionPromise = this.strategy.processPayment(
        params,
        onStateChange
      );
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new PaymentSDKError(
              "TIMEOUT" /* TIMEOUT */,
              "Transaction timed out"
            )
          );
        }, this.timeoutMs);
      });
      const result = await Promise.race([transactionPromise, timeoutPromise]);
      const duration = (0, import_dayjs.default)().diff(startTime, "millisecond");
      this.logger?.info("Transaction completed successfully", {
        orderId: params.orderRef,
        durationMs: duration
      });
      return result;
    } catch (error) {
      if (error instanceof PaymentSDKError) {
        return {
          success: false,
          status: error.code === "DECLINED" /* DECLINED */ ? "FAILED" /* FAILED */ : "ERROR" /* ERROR */,
          errorCode: error.code,
          errorMessage: error.message,
          orderId: params.orderRef
        };
      }
      return {
        success: false,
        status: "ERROR" /* ERROR */,
        errorCode: "UNKNOWN" /* UNKNOWN */,
        errorMessage: error instanceof Error ? error.message : "Unknown fatal error",
        orderId: params.orderRef
      };
    }
  }
  async cancel(onStateChange) {
    this.logger?.info("Attempting cancellation");
    try {
      const result = await this.strategy.cancelTransaction(onStateChange);
      return result;
    } catch (error) {
      this.logger?.error("Cancellation failed", error);
      return false;
    }
  }
};

// src/types/device.ts
var AppReaderStatus = /* @__PURE__ */ ((AppReaderStatus2) => {
  AppReaderStatus2["CONNECTING"] = "CONNECTING";
  AppReaderStatus2["CONNECTED"] = "CONNECTED";
  AppReaderStatus2["OFFLINE"] = "OFFLINE";
  AppReaderStatus2["DISCONNECTED"] = "DISCONNECTED";
  return AppReaderStatus2;
})(AppReaderStatus || {});

// src/version.ts
var VERSION = "1.0.6";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppReaderStatus,
  MunchiPaymentSDK,
  PaymentInteractionState,
  SdkPaymentStatus,
  VERSION
});
