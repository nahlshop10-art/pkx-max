import { onRequestGet as __api_admin_orders_ts_onRequestGet } from "/root/Downloads/paikarixnewmax-main/functions/api/admin_orders.ts"
import { onRequestGet as __api_admin_state_ts_onRequestGet } from "/root/Downloads/paikarixnewmax-main/functions/api/admin_state.ts"
import { onRequestPost as __api_customers_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/customers.ts"
import { onRequestPost as __api_facebook_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/facebook.ts"
import { onRequestPost as __api_ga4_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/ga4.ts"
import { onRequestPost as __api_gc_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/gc.ts"
import { onRequestGet as __api_get_admins_ts_onRequestGet } from "/root/Downloads/paikarixnewmax-main/functions/api/get_admins.ts"
import { onRequestPost as __api_get_my_orders_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/get_my_orders.ts"
import { onRequestPost as __api_login_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/login.ts"
import { onRequestPost as __api_logout_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/logout.ts"
import { onRequestPost as __api_orders_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/orders.ts"
import { onRequestPost as __api_products_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/products.ts"
import { onRequestPost as __api_public_add_to_order_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/public_add_to_order.ts"
import { onRequestPost as __api_public_cancel_order_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/public_cancel_order.ts"
import { onRequestPost as __api_public_checkout_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/public_checkout.ts"
import { onRequestPost as __api_public_incomplete_order_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/public_incomplete_order.ts"
import { onRequestGet as __api_public_state_ts_onRequestGet } from "/root/Downloads/paikarixnewmax-main/functions/api/public_state.ts"
import { onRequestPost as __api_register_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/register.ts"
import { onRequestPost as __api_run_retention_cleanup_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/run_retention_cleanup.ts"
import { onRequestPost as __api_send_telegram_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/send_telegram.ts"
import { onRequestPost as __api_settings_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/settings.ts"
import { onRequestOptions as __api_sync_apply_ts_onRequestOptions } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_apply.ts"
import { onRequestPost as __api_sync_apply_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_apply.ts"
import { onRequestOptions as __api_sync_check_ts_onRequestOptions } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_check.ts"
import { onRequestPost as __api_sync_check_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_check.ts"
import { onRequestGet as __api_sync_data_ts_onRequestGet } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_data.ts"
import { onRequestOptions as __api_sync_data_ts_onRequestOptions } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_data.ts"
import { onRequestOptions as __api_sync_deduct_stock_ts_onRequestOptions } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_deduct_stock.ts"
import { onRequestPost as __api_sync_deduct_stock_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/sync_deduct_stock.ts"
import { onRequestPost as __api_tiktok_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/tiktok.ts"
import { onRequestPost as __api_upload_ts_onRequestPost } from "/root/Downloads/paikarixnewmax-main/functions/api/upload.ts"
import { onRequest as __api__middleware_ts_onRequest } from "/root/Downloads/paikarixnewmax-main/functions/api/_middleware.ts"

export const routes = [
    {
      routePath: "/api/admin_orders",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_orders_ts_onRequestGet],
    },
  {
      routePath: "/api/admin_state",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_state_ts_onRequestGet],
    },
  {
      routePath: "/api/customers",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_customers_ts_onRequestPost],
    },
  {
      routePath: "/api/facebook",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_facebook_ts_onRequestPost],
    },
  {
      routePath: "/api/ga4",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ga4_ts_onRequestPost],
    },
  {
      routePath: "/api/gc",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_gc_ts_onRequestPost],
    },
  {
      routePath: "/api/get_admins",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_get_admins_ts_onRequestGet],
    },
  {
      routePath: "/api/get_my_orders",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_get_my_orders_ts_onRequestPost],
    },
  {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_ts_onRequestPost],
    },
  {
      routePath: "/api/logout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_logout_ts_onRequestPost],
    },
  {
      routePath: "/api/orders",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_orders_ts_onRequestPost],
    },
  {
      routePath: "/api/products",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_products_ts_onRequestPost],
    },
  {
      routePath: "/api/public_add_to_order",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_public_add_to_order_ts_onRequestPost],
    },
  {
      routePath: "/api/public_cancel_order",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_public_cancel_order_ts_onRequestPost],
    },
  {
      routePath: "/api/public_checkout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_public_checkout_ts_onRequestPost],
    },
  {
      routePath: "/api/public_incomplete_order",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_public_incomplete_order_ts_onRequestPost],
    },
  {
      routePath: "/api/public_state",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_public_state_ts_onRequestGet],
    },
  {
      routePath: "/api/register",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_register_ts_onRequestPost],
    },
  {
      routePath: "/api/run_retention_cleanup",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_run_retention_cleanup_ts_onRequestPost],
    },
  {
      routePath: "/api/send_telegram",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_send_telegram_ts_onRequestPost],
    },
  {
      routePath: "/api/settings",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_settings_ts_onRequestPost],
    },
  {
      routePath: "/api/sync_apply",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_sync_apply_ts_onRequestOptions],
    },
  {
      routePath: "/api/sync_apply",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_apply_ts_onRequestPost],
    },
  {
      routePath: "/api/sync_check",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_sync_check_ts_onRequestOptions],
    },
  {
      routePath: "/api/sync_check",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_check_ts_onRequestPost],
    },
  {
      routePath: "/api/sync_data",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_sync_data_ts_onRequestGet],
    },
  {
      routePath: "/api/sync_data",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_sync_data_ts_onRequestOptions],
    },
  {
      routePath: "/api/sync_deduct_stock",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_sync_deduct_stock_ts_onRequestOptions],
    },
  {
      routePath: "/api/sync_deduct_stock",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sync_deduct_stock_ts_onRequestPost],
    },
  {
      routePath: "/api/tiktok",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_tiktok_ts_onRequestPost],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_ts_onRequestPost],
    },
  {
      routePath: "/api",
      mountPath: "/api",
      method: "",
      middlewares: [__api__middleware_ts_onRequest],
      modules: [],
    },
  ]