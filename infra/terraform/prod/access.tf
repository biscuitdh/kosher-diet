locals {
  cloudflare_access_allowed_email_rules = [
    for email in sort(tolist(var.allowed_emails)) : {
      email = {
        email = email
      }
    }
  ]
}

resource "cloudflare_zero_trust_access_identity_provider" "google" {
  account_id = var.cloudflare_account_id
  name       = "Google"
  type       = "google"

  config = {
    client_id     = var.google_oauth_client_id
    client_secret = var.google_oauth_client_secret
  }
}

resource "cloudflare_zero_trust_access_policy" "koshertable_allowed_users" {
  account_id       = var.cloudflare_account_id
  name             = "KosherTable approved Google accounts"
  decision         = "allow"
  include          = local.cloudflare_access_allowed_email_rules
  session_duration = var.cloudflare_access_session_duration
}

resource "cloudflare_zero_trust_access_application" "koshertable" {
  account_id = var.cloudflare_account_id
  name       = "KosherTable"
  type       = "self_hosted"
  domain     = var.domain

  destinations = [{
    type = "public"
    uri  = var.domain
  }]

  allowed_idps               = [cloudflare_zero_trust_access_identity_provider.google.id]
  app_launcher_visible       = false
  auto_redirect_to_identity  = true
  enable_binding_cookie      = true
  http_only_cookie_attribute = true
  session_duration           = var.cloudflare_access_session_duration

  policies = [{
    id         = cloudflare_zero_trust_access_policy.koshertable_allowed_users.id
    precedence = 1
  }]
}
