resource "google_project_service" "required" {
  for_each = toset([
    "apikeys.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbilling.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "firebaserules.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "identitytoolkit.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com"
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
