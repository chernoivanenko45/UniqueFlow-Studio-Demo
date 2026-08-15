(() => {
  "use strict";

  const config = window.UNIQUEFLOW_SALES || {};
  const encoder = new TextEncoder();

  function base64Url(bytes) {
    let binary = "";
    bytes.forEach((value) => { binary += String.fromCharCode(value); });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function sha256Hex(value) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function priceIdFor(plan) {
    const value = plan === "lifetime" ? config.paddleLifetimePriceId : config.paddleMonthlyPriceId;
    return typeof value === "string" && !value.includes("REPLACE_") ? value : "";
  }

  function paddleConfigured() {
    return Boolean(
      window.Paddle
      && typeof config.paddleClientToken === "string"
      && !config.paddleClientToken.includes("REPLACE_"),
    );
  }

  function setCheckoutState(message, kind = "muted") {
    document.querySelectorAll("[data-checkout-state]").forEach((node) => {
      node.textContent = message;
      node.dataset.kind = kind;
    });
  }

  function currentLocale() {
    return document.documentElement.lang === "ru" ? "ru" : "en";
  }

  function successUrl() {
    const locale = currentLocale();
    return new URL(locale === "ru" ? "success/" : "../en/success/", window.location.href).href;
  }

  async function beginCheckout(button) {
    const plan = button.dataset.plan === "lifetime" ? "lifetime" : "monthly";
    const priceId = priceIdFor(plan);
    if (!paddleConfigured() || !priceId) return;
    button.disabled = true;
    setCheckoutState(currentLocale() === "ru" ? "Открываем защищённую оплату…" : "Opening secure checkout…", "working");
    try {
      const claimToken = base64Url(crypto.getRandomValues(new Uint8Array(32)));
      const claimHash = await sha256Hex(claimToken);
      sessionStorage.setItem("uf_order_claim_token", claimToken);

      window.Paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { source: "uniqueflow_sales_v1", claim_hash: claimHash, plan },
        settings: {
          displayMode: "overlay",
          theme: "dark",
          locale: currentLocale(),
          successUrl: successUrl(),
          showAddDiscounts: true,
        },
      });
      setCheckoutState(currentLocale() === "ru" ? "Окно оплаты открыто" : "Checkout is open", "ready");
    } catch (error) {
      console.error("Checkout initialization failed", error);
      setCheckoutState(currentLocale() === "ru" ? "Не удалось открыть оплату. Попробуйте ещё раз." : "Could not open checkout. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  }

  function initializeCheckout() {
    // Claim secrets only need to survive the same-tab Paddle redirect. Remove
    // values left by older builds so they do not persist in the browser.
    localStorage.removeItem("uf_order_claim_token");
    localStorage.removeItem("uf_order_claim_hash");
    const buttons = document.querySelectorAll("[data-buy-button]");
    if (!paddleConfigured()) {
      buttons.forEach((button) => {
        button.disabled = true;
        button.title = currentLocale() === "ru" ? "Paddle sandbox ещё не настроен" : "Paddle sandbox is not configured yet";
      });
      setCheckoutState(
        currentLocale() === "ru"
          ? "Предпродажная сборка: реальные платежи пока отключены"
          : "Pre-launch build: real payments are currently disabled",
      );
      return;
    }

    if (config.environment === "sandbox") window.Paddle.Environment.set("sandbox");
    window.Paddle.Initialize({
      token: config.paddleClientToken,
      eventCallback(event) {
        if (event?.name === "checkout.completed") window.location.assign(successUrl());
      },
    });
    let available = 0;
    buttons.forEach((button) => {
      const plan = button.dataset.plan === "lifetime" ? "lifetime" : "monthly";
      if (!priceIdFor(plan)) {
        button.disabled = true;
        button.title = currentLocale() === "ru" ? "Этот тариф Sandbox ещё не настроен" : "This Sandbox plan is not configured yet";
        return;
      }
      available += 1;
      button.addEventListener("click", () => beginCheckout(button));
    });
    setCheckoutState(
      available > 0
        ? (currentLocale() === "ru" ? "Защищённая оплата Paddle" : "Secure checkout by Paddle")
        : (currentLocale() === "ru" ? "Тарифы Paddle Sandbox ещё не настроены" : "Paddle Sandbox plans are not configured yet"),
      available > 0 ? "ready" : "muted",
    );
  }

  window.addEventListener("DOMContentLoaded", initializeCheckout, { once: true });
})();
