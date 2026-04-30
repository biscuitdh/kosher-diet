variable "project_id" {
  description = "GCP project ID for KosherTable."
  type        = string
  default     = "koshertable-prod"
}

variable "project_name" {
  description = "Human-readable GCP project name."
  type        = string
  default     = "KosherTable Prod"
}

variable "billing_account_id" {
  description = "GCP billing account ID to attach to the project."
  type        = string
  sensitive   = true
}

variable "create_project" {
  description = "Set true to let Terraform create the GCP project. Set false if you created it manually."
  type        = bool
  default     = true
}

variable "organization_id" {
  description = "GCP organization ID. Required when create_project is true and folder_id is empty."
  type        = string
  default     = ""
}

variable "folder_id" {
  description = "Optional GCP folder ID. Use this instead of organization_id if projects live under a folder."
  type        = string
  default     = ""
}

variable "region" {
  description = "Default Google provider region."
  type        = string
  default     = "us-central1"
}

variable "state_bucket_name" {
  description = "Globally unique GCS bucket name for Terraform state."
  type        = string
  default     = "koshertable-prod-tfstate"
}

variable "state_bucket_location" {
  description = "GCS bucket location for Terraform state."
  type        = string
  default     = "US"
}
