output "firebase_project_id" {
  description = "Firebase project ID."
  value       = var.project_id
}

output "firebase_hosting_site_id" {
  description = "Firebase Hosting site ID."
  value       = google_firebase_hosting_site.default.site_id
}

output "firebase_web_config" {
  description = "Public Firebase web config values for .env.local and GitHub repository variables."
  value = {
    api_key          = data.google_firebase_web_app_config.web.api_key
    auth_domain      = data.google_firebase_web_app_config.web.auth_domain
    app_id           = google_firebase_web_app.web.app_id
    google_client_id = var.google_oauth_client_id
    project_id       = var.project_id
  }
}

output "firebase_custom_domain_dns_updates" {
  description = "Firebase-required DNS updates. Copy these into firebase_dns_records for the second Terraform apply."
  value       = google_firebase_hosting_custom_domain.primary.required_dns_updates
}

output "github_actions_repository_variables" {
  description = "GitHub repository variables needed by the Firebase deploy workflow."
  value = {
    GCP_WORKLOAD_IDENTITY_PROVIDER = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOY_SERVICE_ACCOUNT     = google_service_account.github_deploy.email
    NEXT_PUBLIC_FIREBASE_API_KEY   = data.google_firebase_web_app_config.web.api_key
    NEXT_PUBLIC_FIREBASE_APP_ID    = google_firebase_web_app.web.app_id
    NEXT_PUBLIC_GOOGLE_CLIENT_ID   = var.google_oauth_client_id
  }
}

output "cloudflare_access_application_id" {
  description = "Cloudflare Access application ID for KosherTable."
  value       = cloudflare_zero_trust_access_application.koshertable.id
}

output "cloudflare_google_oauth_redirect_uri" {
  description = "Authorized redirect URI that must be present on the Google OAuth web client."
  value       = "https://${var.cloudflare_zero_trust_team_name}.cloudflareaccess.com/cdn-cgi/access/callback"
}

output "monthly_budget_amount_usd" {
  description = "Monthly Google Cloud budget alert amount."
  value       = var.budget_amount_usd
}
