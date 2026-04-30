resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.required]
}

resource "google_firebase_web_app" "web" {
  provider     = google-beta
  project      = google_firebase_project.default.project
  display_name = "KosherTable Web"

  deletion_policy = "DELETE"
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.web.app_id
}

resource "google_identity_platform_config" "auth" {
  provider = google-beta
  project  = var.project_id

  autodelete_anonymous_users = true

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = false
      password_required = false
    }

    phone_number {
      enabled            = false
      test_phone_numbers = {}
    }
  }

  authorized_domains = distinct([
    "localhost",
    var.domain,
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app"
  ])

  depends_on = [
    google_firebase_project.default,
    google_project_service.required
  ]
}

resource "google_identity_platform_default_supported_idp_config" "google" {
  provider = google-beta
  project  = var.project_id

  enabled       = true
  idp_id        = "google.com"
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret

  depends_on = [google_identity_platform_config.auth]
}

resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.hosting_site_id
  app_id   = google_firebase_web_app.web.app_id

  depends_on = [google_firebase_project.default]
}

resource "google_firebase_hosting_custom_domain" "primary" {
  provider              = google-beta
  project               = var.project_id
  site_id               = google_firebase_hosting_site.default.site_id
  custom_domain         = var.domain
  cert_preference       = "GROUPED"
  wait_dns_verification = false
}
