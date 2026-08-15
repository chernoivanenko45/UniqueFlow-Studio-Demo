(() => {
  "use strict";

  const config = window.UNIQUEFLOW_SALES || {};
  const isRu = document.documentElement.lang === "ru";
  const statusNode = document.querySelector("[data-claim-status]");
  const resultNode = document.querySelector("[data-license-result]");
  const keyNode = document.querySelector("[data-license-key]");
  const downloadNode = document.querySelector("[data-download-link]");
  const copyNode = document.querySelector("[data-copy-key]");
  let attempts = 0;

  function setStatus(message, kind = "working") {
    statusNode.textContent = message;
    statusNode.dataset.kind = kind;
  }

  function claimToken() {
    return sessionStorage.getItem("uf_order_claim_token") || localStorage.getItem("uf_order_claim_token") || "";
  }

  async function claim() {
    const token = claimToken();
    if (!token) {
      setStatus(
        isRu ? "Секрет заказа не найден в этом браузере. Напишите в поддержку." : "Order secret was not found in this browser. Contact support.",
        "error",
      );
      return;
    }
    attempts += 1;
    try {
      const response = await fetch(`${config.licenseApiBase}/v1/orders/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_token: token }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      const data = await response.json();
      if (response.status === 404 && data.code === "order_pending" && attempts < 45) {
        setStatus(isRu ? "Платёж подтверждается… обычно это занимает несколько секунд." : "Confirming payment… this usually takes a few seconds.");
        window.setTimeout(claim, 2000);
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.message || data.code || `HTTP ${response.status}`);

      keyNode.textContent = data.license_key;
      downloadNode.href = data.download_url;
      resultNode.hidden = false;
      localStorage.removeItem("uf_order_claim_token");
      localStorage.removeItem("uf_order_claim_hash");
      setStatus(isRu ? "Готово — ключ и установщик доступны ниже." : "Done — your key and installer are ready below.", "ready");
    } catch (error) {
      console.error("Order claim failed", error);
      setStatus(
        isRu ? "Не удалось получить заказ автоматически. Обновите страницу или напишите в поддержку." : "Could not retrieve the order automatically. Refresh or contact support.",
        "error",
      );
    }
  }

  copyNode?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(keyNode.textContent || "");
    copyNode.textContent = isRu ? "Скопировано" : "Copied";
  });
  window.addEventListener("DOMContentLoaded", claim, { once: true });
})();
