import type { BlockingService } from "./sync-error";
import { buildWooUserAgentFromBrand, userAgentProductToken } from "./sync-error";

export interface WafFix {
  service: BlockingService;
  title: string;
  vendorName: string;
  vendorUrl?: string;
  steps: string[];
  copyableExpression?: string;
  copyableExpressionLabel?: string;
  adminMessage: string;
}

export function getFixForService(service: BlockingService, brandName: string): WafFix {
  const token = userAgentProductToken(brandName);
  const fullUa = buildWooUserAgentFromBrand(brandName);

  const FIXES: Record<BlockingService, WafFix> = {
    cloudflare: {
      service: "cloudflare",
      title: "Cloudflare is challenging our API requests",
      vendorName: "Cloudflare",
      vendorUrl: "https://dash.cloudflare.com",
      steps: [
        "Log in to your Cloudflare dashboard and select your domain.",
        "Go to Security → WAF → Custom rules → Create rule.",
        "Name the rule: \"Allow WooCommerce API Integration\".",
        "Paste the expression below into the Expression editor (Edit expression).",
        "Set Action to: Skip → check 'All managed rules' and 'Bot Fight Mode'.",
        "Deploy the rule.",
        "If you use Super Bot Fight Mode, also whitelist the User-Agent under Security → Bots → Configure.",
      ],
      copyableExpression: `(http.request.uri.path contains "/wp-json/wc/") or (http.request.uri.path contains "/wp-json/wp/v2/media") or (http.user_agent contains "${token}")`,
      copyableExpressionLabel: "Cloudflare expression",
      adminMessage: `Hi,

Our WooCommerce integration (${brandName}) is being blocked by Cloudflare's Managed Challenge on this site. Could you please add the following Custom WAF Rule in your Cloudflare dashboard?

1. Go to Security → WAF → Custom rules → Create rule
2. Name: "Allow WooCommerce API Integration"
3. Expression (paste exactly):
(http.request.uri.path contains "/wp-json/wc/") or (http.request.uri.path contains "/wp-json/wp/v2/media") or (http.user_agent contains "${token}")
4. Action: Skip → All managed rules, Bot Fight Mode
5. Deploy

This only whitelists our API path and our identifiable User-Agent (${fullUa}) — the rest of your site stays fully protected.

Thanks!`,
    },
    sucuri: {
      service: "sucuri",
      title: "Sucuri firewall is blocking API requests",
      vendorName: "Sucuri",
      vendorUrl: "https://waf.sucuri.net",
      steps: [
        "Log in to your Sucuri Firewall dashboard at waf.sucuri.net.",
        "Open Firewall Settings → Access Control → Whitelist User-Agents.",
        `Add User-Agent: ${fullUa}`,
        "Optionally, whitelist the URL path /wp-json/wc/* under Whitelist URLs.",
        "Save and wait up to 2 minutes for the rule to propagate.",
      ],
      adminMessage: `Hi,

Sucuri Firewall is blocking our WooCommerce integration (${brandName}). Please whitelist the following in your Sucuri dashboard:

User-Agent: ${fullUa}
Path: /wp-json/wc/*

Steps:
1. Log in at https://waf.sucuri.net
2. Firewall Settings → Access Control
3. Add both entries to the whitelist
4. Save

Thanks!`,
    },
    wordfence: {
      service: "wordfence",
      title: "WordFence is limiting access to our integration",
      vendorName: "WordFence",
      vendorUrl: "https://www.wordfence.com",
      steps: [
        "Log in to your WordPress admin and go to WordFence → All Options.",
        "Scroll to 'Brute Force Protection' and 'Rate Limiting'.",
        "Under Rate Limiting, set 'If anyone's requests exceed' to a high value OR add User-Agent exception.",
        "Go to WordFence → Tools → Allowlisted URLs.",
        "Add pattern: /wp-json/wc/*",
        `Under 'Allowlisted Services', add User-Agent: ${fullUa}`,
        "Save changes.",
      ],
      adminMessage: `Hi,

WordFence is limiting access for our WooCommerce integration (${brandName}). Please allowlist us:

1. WordPress admin → WordFence → Tools → Allowlisted URLs
2. Add pattern: /wp-json/wc/*
3. Under 'Allowlisted Services' add User-Agent: ${fullUa}
4. Save

If rate limiting is very aggressive, also relax limits under WordFence → All Options → Rate Limiting.

Thanks!`,
    },
    "aws-waf": {
      service: "aws-waf",
      title: "AWS WAF is blocking our requests",
      vendorName: "AWS WAF",
      vendorUrl: "https://console.aws.amazon.com/wafv2",
      steps: [
        "Log in to your AWS Console and open AWS WAF & Shield.",
        "Select the Web ACL protecting this site.",
        "Add a new rule with priority 0 (evaluated first).",
        "Rule type: Regular rule with statement: URI path string contains '/wp-json/wc/'.",
        "Action: Allow.",
        "Save and update the Web ACL.",
      ],
      adminMessage: `Hi,

AWS WAF is blocking our WooCommerce integration (${brandName}). Please add a rule:

- Web ACL: (the one protecting this site)
- Rule type: Regular rule
- Statement: URI path contains '/wp-json/wc/'
- Action: Allow
- Priority: 0 (highest)

Thanks!`,
    },
    modsecurity: {
      service: "modsecurity",
      title: "ModSecurity (server firewall) is rejecting our requests",
      vendorName: "ModSecurity / cPanel",
      steps: [
        "Contact your hosting provider (SiteGround, Bluehost, HostGator, etc.) and ask them to whitelist requests to /wp-json/wc/* for this domain.",
        "If you have cPanel/WHM access: ModSecurity Tools → find the triggering rule ID in logs → add an exception.",
        `Alternatively, ask your host to whitelist User-Agent '${token}'.`,
        "If using Apache directly, add to .htaccess: SecRuleRemoveByTag 'OWASP_CRS/WEB_ATTACK/SQL_INJECTION' in the wp-json location.",
      ],
      adminMessage: `Hi,

The server's ModSecurity firewall is blocking our WooCommerce integration (${brandName}) with a 403/406 error on /wp-json/wc/ requests.

Please contact your hosting provider's support and ask them to:
1. Whitelist /wp-json/wc/* for this domain
2. Or whitelist User-Agent: ${fullUa}

Most hosts (SiteGround, Bluehost, Hostinger, A2 Hosting) will do this via a quick support ticket.

Thanks!`,
    },
    unknown: {
      service: "unknown",
      title: "Something is blocking our requests — service not identified",
      vendorName: "Unknown firewall",
      steps: [
        "Check active security plugins in WordPress admin (e.g., WordFence, iThemes Security, All In One WP Security, Solid Security).",
        "Ask your hosting provider whether they run a server-level firewall (ModSecurity, Imunify360, BitNinja).",
        `Check your server access logs for the User-Agent '${fullUa}' — the log entry usually shows which rule rejected the request.`,
        `Allowlist the /wp-json/wc/* path or the User-Agent '${fullUa}' wherever firewalls or security plugins are configured.`,
        "If you use Cloudflare, Sucuri, or WordFence, enable the corresponding rule from their dashboards.",
      ],
      adminMessage: `Hi,

Our WooCommerce integration (${brandName}) is receiving 403 responses from this site, but we cannot automatically identify which security layer is blocking us.

Please check:
1. Active WordPress security plugins (WordFence, iThemes, etc.)
2. Hosting-level firewall (ModSecurity, Imunify360)
3. Server access logs for User-Agent "${fullUa}"

Then whitelist either:
- URL pattern: /wp-json/wc/*
- User-Agent: ${fullUa}

Thanks!`,
    },
  };

  return FIXES[service] || FIXES.unknown;
}

export function getAllFixes(brandName: string): WafFix[] {
  return (["cloudflare", "sucuri", "wordfence", "aws-waf", "modsecurity", "unknown"] as const).map((s) =>
    getFixForService(s, brandName)
  );
}
