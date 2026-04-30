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
  default     = "biscuitdh/kosher-diet"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for netsbyvets.org."
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token with Zone:Read and DNS:Edit for netsbyvets.org."
  type        = string
  sensitive   = true
  default     = null
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
