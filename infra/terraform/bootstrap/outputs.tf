output "project_id" {
  description = "GCP project ID managed by bootstrap."
  value       = local.effective_project_id
}

output "state_bucket_name" {
  description = "GCS bucket to use in the prod Terraform backend."
  value       = google_storage_bucket.terraform_state.name
}
