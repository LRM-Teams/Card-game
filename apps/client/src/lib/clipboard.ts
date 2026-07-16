/**
 * 复制文本到剪贴板，兼容非安全上下文（HTTP / 局域网 IP）。
 *
 * `navigator.clipboard.writeText` 仅在安全上下文（HTTPS 或 localhost）可用；
 * 通过局域网 IP 以 HTTP 访问时它为 undefined，点击复制会静默失败。
 * 这里在 clipboard API 不可用时回退到临时 textarea + execCommand。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 权限被拒或不可用，走回退
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
