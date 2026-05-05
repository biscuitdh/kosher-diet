variable "project_id" {
  description = "GCP/Firebase project ID."
  type        = string
  default     = "koshertable-prod"
}

variable "billing_account_id" {
  description = "GCP billing account ID used for budget alerts."
  type        = string
  sensitive   = true
}

variable "region" {
  description = "Default Google provider region."
  type        = string
  default     = "us-central1"
}

variable "firestore_location" {
  description = "Firestore database location. This is immutable after creation."
  type        = string
  default     = "nam5"
}

variable "domain" {
  description = "Production Firebase Hosting custom domain."
  type        = string
  default     = "kosher.netsbyvets.org"
}

variable "hosting_site_id" {
  description = "Firebase Hosting site ID."
  type        = string
  default     = "koshertable-prod"
}

variable "allowed_emails" {
  description = "Lowercase emails allowed to sync the shared household data."
  type        = set(string)

  validation {
    condition     = alltrue([for email in var.allowed_emails : email == lower(email)])
    error_message = "allowed_emails must be lowercase."
  }
}

variable "google_oauth_client_id" {
  description = "Google OAuth web client ID used for Google sign-in."
  type        = string
}

variable "google_oauth_client_secret" {
  description = "Google OAuth web client secret used by the Firebase Google provider."
  type        = string
  sensitive   = true
}

variable "budget_amount_usd" {
  description = "Monthly Google Cloud budget alert amount in USD."
  type        = number
  default     = 5
}

variable "github_repository" {
  description = "GitHub repository allowed to deploy via Workload Identity Federation."
  type        = string
  default     = "biscuitdh/webapps"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for netsbyvets.org."
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID that owns the Zero Trust team."
  type        = string
}

variable "cloudflare_zero_trust_team_name" {
  description = "Cloudflare Zero Trust team name used in Access callback URLs."
  type        = string
  default     = "netsbyvets"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone:Read, DNS:Edit, Access: Apps and Policies Write, and Access: Organizations, Identity Providers, and Groups Write."
  type        = string
  sensitive   = true
  default     = null
}

variable "cloudflare_access_session_duration" {
  description = "Cloudflare Access session duration for KosherTable."
  type        = string
  default     = "24h"
}

variable "firebase_dns_records" {
  description = "Firebase-provided DNS records to create in Cloudflare on the second apply."
  type = list(object({
    name    = string
    type    = string
    content = string
    ttl     = optional(number, 300)
    proxied = optional(bool, false)
  }))
  default = []
}
