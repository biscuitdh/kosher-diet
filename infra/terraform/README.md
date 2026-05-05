# KosherTable Terraform

This folder makes the Firebase/GCP launch repeatable:

- `bootstrap/` creates or links the GCP project and creates the GCS state bucket.
- `prod/` manages Firebase, Firestore, rules, Google sign-in, allowed users, Hosting, Cloudflare DNS, budget alerts, and GitHub deploy identity.

Budgets are alerts only. Google Cloud does not hard-stop spend at `$5`.

## 1. Bootstrap state

Copy the example file and fill in your real values:

```bash
cp infra/terraform/bootstrap/terraform.tfvars.example infra/terraform/bootstrap/terraform.tfvars
```

If your Google account is not under a GCP organization, create `koshertable-prod` in the Cloud Console first and set:

```hcl
create_project = false
```

Then run:

```bash
cd infra/terraform/bootstrap
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## 2. Apply production infrastructure

Copy the production example file:

```bash
cp infra/terraform/prod/terraform.tfvars.example infra/terraform/prod/terraform.tfvars
```

Fill in:

- `billing_account_id`
- `allowed_emails`
- `google_oauth_client_id`
- `google_oauth_client_secret`
- `cloudflare_zone_id`
- `cloudflare_account_id`
- `cloudflare_api_token`

Then run:

```bash
cd infra/terraform/prod
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## 3. Add Firebase DNS records

After the first production apply, inspect:

```bash
terraform output firebase_custom_domain_dns_updates
```

Translate those Firebase records into `firebase_dns_records` in `infra/terraform/prod/terraform.tfvars`.
Keep `proxied = false` so Cloudflare stays DNS-only while Firebase provisions SSL.
If Firebase reports an ACME TXT challenge for the certificate, add that `_acme-challenge` TXT record to `firebase_dns_records` and apply again.

Run:

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

## 4. Protect the custom domain with Cloudflare Access

The Cloudflare token used for this apply must include:

- `Zone:Read`
- `DNS:Edit`
- `Access: Apps and Policies Write`
- `Access: Organizations, Identity Providers, and Groups Write`

The production stack creates:

- a Google Access identity provider
- a self-hosted Access application for `kosher.netsbyvets.org`
- an allow policy for every email in `allowed_emails`

Before testing login, make sure the Google OAuth web client has this authorized redirect URI:

```bash
terraform output cloudflare_google_oauth_redirect_uri
```

After Access is created, set the `kosher.netsbyvets.org` CNAME record in `firebase_dns_records` to `proxied = true`, then apply again. At that point Cloudflare should intercept unauthenticated requests before Firebase serves the app HTML.

## 5. Configure GitHub repository variables

Print the values:

```bash
terraform output github_actions_repository_variables
```

In GitHub, open `biscuitdh/webapps` -> Settings -> Secrets and variables -> Actions -> Variables.

Create these repository variables:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

## 6. Deploy flow

Pull requests deploy Firebase preview channels.
Pushes to `main` deploy live Hosting.
Firestore rules are managed by Terraform, not by GitHub Actions, so rule changes require `terraform apply`.

The workflow still runs:

- `npm --prefix apps/kosher-table run typecheck`
- `npm --prefix apps/kosher-table run lint`
- `npm --prefix apps/kosher-table run test`
- `npm --prefix apps/kosher-table run images:check`
- `npm --prefix apps/kosher-table run build:firebase`

GitHub Pages stays separate through `npm run build:github`.
