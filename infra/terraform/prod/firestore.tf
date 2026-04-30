resource "google_firestore_database" "default" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required]
}

resource "google_firebaserules_ruleset" "firestore" {
  project = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../../../firestore.rules")
    }
  }

  depends_on = [
    google_firestore_database.default,
    google_project_service.required
  ]
}

resource "google_firebaserules_release" "firestore" {
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name
}

resource "google_firestore_document" "allowed_users" {
  for_each = var.allowed_emails

  provider    = google-beta
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = "allowed_users"
  document_id = each.value
  fields = jsonencode({
    createdBy = {
      stringValue = "terraform"
    }
  })
}
