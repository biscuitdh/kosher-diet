locals {
  project_parent_is_valid = var.create_project == false || var.organization_id != "" || var.folder_id != ""
}

resource "google_project" "koshertable" {
  count = var.create_project ? 1 : 0

  name            = var.project_name
  project_id      = var.project_id
  billing_account = var.billing_account_id
  org_id          = var.folder_id == "" ? var.organization_id : null
  folder_id       = var.folder_id != "" ? var.folder_id : null

  labels = {
    app        = "koshertable"
    managed_by = "terraform"
  }

  lifecycle {
    precondition {
      condition     = local.project_parent_is_valid
      error_message = "Set organization_id or folder_id when create_project is true."
    }
  }
}

data "google_project" "existing" {
  count      = var.create_project ? 0 : 1
  project_id = var.project_id
}

locals {
  effective_project_id = var.create_project ? google_project.koshertable[0].project_id : data.google_project.existing[0].project_id
}

resource "google_project_service" "bootstrap" {
  for_each = toset([
    "cloudbilling.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com"
  ])

  project            = local.effective_project_id
  service            = each.value
  disable_on_destroy = false

  depends_on = [google_project.koshertable]
}

resource "google_storage_bucket" "terraform_state" {
  name                        = var.state_bucket_name
  project                     = local.effective_project_id
  location                    = var.state_bucket_location
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  labels = {
    app        = "koshertable"
    managed_by = "terraform"
    purpose    = "terraform-state"
  }

  depends_on = [google_project_service.bootstrap]
}
