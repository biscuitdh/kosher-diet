# Firebase/GCP launch checklist

This deploy path serves KosherTable at `https://kosher.netsbyvets.org` from Firebase Hosting.
Cloudflare remains the DNS provider for `netsbyvets.org`.

## 1. Create the GCP/Firebase project with Terraform

Terraform now owns the GCP/Firebase launch scaffolding under `infra/terraform`.

1. Copy the bootstrap variables:

   ```bash
   cp infra/terraform/bootstrap/terraform.tfvars.example infra/terraform/bootstrap/terraform.tfvars
   ```

2. Edit `infra/terraform/bootstrap/terraform.tfvars`.
   - Set `billing_account_id`.
   - If your Google account is not under a GCP organization, create the `koshertable-prod` project manually in the Cloud Console and set `create_project = false`.
   - If Terraform creates the project, set `organization_id` or `folder_id`.
3. Run bootstrap:

   ```bash
   cd infra/terraform/bootstrap
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

4. Copy the production variables:

   ```bash
   cd ../../..
   cp infra/terraform/prod/terraform.tfvars.example infra/terraform/prod/terraform.tfvars
   ```

5. Create a Google OAuth web client for sign-in:
   - Open Google Cloud Console.
   - Select the `koshertable-prod` project.
   - Open **APIs & Services** -> **OAuth consent screen**.
   - Create or update the consent screen with app name `KosherTable`, your support email, and your developer contact email.
   - Open **APIs & Services** -> **Credentials**.
   - Click **Create credentials** -> **OAuth client ID**.
   - Choose **Web application**.
   - Name it `KosherTable Web`.
   - Add these **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://kosher.netsbyvets.org`
     - `https://koshertable-prod.firebaseapp.com`
     - `https://koshertable-prod.web.app`
   - Save it.
   - Copy the client ID and client secret.
6. Edit `infra/terraform/prod/terraform.tfvars`.
   - Set `billing_account_id`.
   - Set `allowed_emails` to the lowercase Google account emails allowed to sync household data.
   - Set `google_oauth_client_id` to the OAuth web client ID.
   - Set `google_oauth_client_secret` to the OAuth web client secret.
   - Set `cloudflare_zone_id`.
   - Set `cloudflare_api_token`.
   - Keep `budget_amount_usd = 5`.
7. Apply production infrastructure:

   ```bash
   cd infra/terraform/prod
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

Terraform creates Firebase, Firestore, Google Auth config, the Firestore whitelist docs, Firebase Hosting, the custom domain resource, a $5 monthly budget alert, and GitHub Workload Identity Federation.

Copy the Firebase Web app config values from Terraform output into `.env.local` for local testing:

```bash
terraform output firebase_web_config
```

Then create `.env.local`:

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=koshertable-prod
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
   ```

Only signed-in, email-verified Google accounts with matching `allowed_users/{email}` documents can read or write the shared household favorites and groceries. Terraform creates those docs from `allowed_emails`.

## 2. Connect the Cloudflare subdomain

The first production Terraform apply creates the Firebase custom domain and outputs DNS records:

```bash
terraform output firebase_custom_domain_dns_updates
```

1. Translate those records into `firebase_dns_records` in `infra/terraform/prod/terraform.tfvars`.
2. Keep every Cloudflare record `proxied = false` while Firebase provisions SSL.
   - Firebase may also ask for a `_acme-challenge.<subdomain>` TXT record while it validates the TLS certificate.
   - Add that TXT record to `firebase_dns_records` too, then apply again.
3. Apply again:

   ```bash
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

4. Wait for Firebase Hosting to show `kosher.netsbyvets.org` as connected.

## 3. Configure GitHub deploy variables

Print deploy values:

```bash
terraform output github_actions_repository_variables
```

In GitHub, open `biscuitdh/kosher-diet` -> Settings -> Secrets and variables -> Actions -> Variables.

Create:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

Pull requests deploy preview channels. Pushes to `main` deploy live Firebase Hosting after checks pass.
Firestore rules are managed by Terraform, so rule changes require a production Terraform apply.

## 4. Manual deploy fallback

If you need to deploy before GitHub variables are configured:

```bash
npm run typecheck
npm run lint
npm test
npm run images:check
npm run build:firebase
firebase login
firebase use koshertable-prod
firebase deploy --only hosting
```

## 5. Launch verification

1. Open `https://kosher.netsbyvets.org` on desktop.
2. Open the same URL on mobile.
3. Sign in with an allowed Google account.
4. Favorite a recipe.
5. Add recipe ingredients to groceries.
6. Refresh on the other device and confirm favorites/groceries sync.
7. Try a non-whitelisted email and confirm it cannot sync household data.
8. Confirm Google Cloud Billing shows the `KosherTable monthly budget` alert at `$5`.
