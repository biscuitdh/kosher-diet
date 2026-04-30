terraform {
  required_version = ">= 1.6.0"

  backend "gcs" {
    bucket = "koshertable-prod-tfstate"
    prefix = "terraform/prod"
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 7.0"
    }
  }
}
