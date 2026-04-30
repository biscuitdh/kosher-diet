locals {
  github_workload_identity_pool_id = "github-actions"
  github_deploy_roles = toset([
    "roles/firebase.viewer",
    "roles/firebasehosting.admin",
    "roles/serviceusage.serviceUsageConsumer"
  ])
  github_workflow_ref = "${var.github_repository}/.github/workflows/firebase-hosting.yml@refs/heads/main"
}

resource "google_service_account" "github_deploy" {
  project      = var.project_id
  account_id   = "github-firebase-deploy"
  display_name = "GitHub Firebase deploy"
  description  = "Deploys KosherTable Firebase Hosting and Firestore rules from GitHub Actions."

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "github_deploy" {
  for_each = local.github_deploy_roles

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = local.github_workload_identity_pool_id
  display_name              = "GitHub Actions"
  description               = "Allows selected GitHub Actions workflows to deploy KosherTable."

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"
  description                        = "OIDC trust for ${var.github_repository}."

  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.workflow_ref == '${local.github_workflow_ref}' && (assertion.ref == 'refs/heads/main' || assertion.event_name == 'pull_request')"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.event_name" = "assertion.event_name"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
    "attribute.workflow"   = "assertion.workflow_ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_workload_identity" {
  service_account_id = google_service_account.github_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
