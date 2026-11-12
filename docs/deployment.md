# Deployment configuration

## Cloudflare Pages frontend

Use the `frontend` directory as the Pages project root, `npm run build` as the build command, and `dist` as the build output directory. Configure `VITE_API_URL` as a Pages build-time variable, including the backend context path, e.g. `https://api.example.com/api`. Cloudflare builds fail if this variable is missing or does not use HTTPS. This value is public and must never contain a secret.

The production Pages hostname is `exa-edulab.pages.dev`. Add any other hostname as a custom domain in the Cloudflare Pages project before using it. Point `VITE_API_URL` at the public URL of the selected backend host, ending in `/api`; do not use the frontend domain for the API unless it is explicitly configured to serve the API there.

If testing the frontend locally against a remote API, set `VITE_API_URL` in the frontend build environment. For the Vite development proxy, use `VITE_API_PROXY_TARGET` for the backend origin, e.g. `https://api.example.com`; local default is `http://localhost:8080`.

To enable Google sign-in, set the public Firebase Web app build variables `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in Cloudflare Pages. Enable Google under Firebase Authentication providers and add the Pages hostname to Firebase Authentication's authorized domains. On the backend, set `FIREBASE_PROJECT_ID` and provide Firebase Admin credentials using the hosting platform's Application Default Credentials or the private `FIREBASE_SERVICE_ACCOUNT_JSON` secret. Never put a service-account JSON file or secret in the frontend or repository. Firebase settings are optional; without them Google sign-in is unavailable.

## Free backend hosting alternatives

The repository supports two alternatives for the Spring Boot API:

1. **Render**: create a Blueprint from the repository root using the checked-in `render.yaml`. It builds with `backend/Dockerfile` and checks `/api/actuator/health`. Review [Render's free-instance limits](https://render.com/docs/free).
2. **Northflank**: create a Build Service connected to this repository, set the build context to the repository root and Dockerfile to `backend/Dockerfile`, then deploy a public service on port `8080`. Set its health check path to `/api/actuator/health`. Review [Northflank's current pricing and free allowance](https://northflank.com/pricing).

Both platforms require these private/runtime variables:

- `SPRING_PROFILES_ACTIVE=prod`
- `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD` for a separately hosted MySQL 8 database
- `JWT_SECRET` (generate a unique random value of at least 32 bytes)
- `CORS_ORIGINS` (exact Cloudflare Pages origin(s), comma-separated; include `https://exa-edulab.pages.dev`)
- `GEMINI_API_KEY` for all AI Import modes: extracting existing questions, creating questions from arbitrary text/content, images, and scanned PDFs. The default model is `gemini-3.6-flash`; set `GEMINI_MODEL` only to override it. AI Import uses Gemini only.

Configure these values in each platform's private environment/secrets settings. ExaBot can fail over across providers with `EXABOT_PROVIDER_ORDER` (default: `gemini,openrouter,openai,groq,deepseek`). Optional provider key/model pairs are `OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, `OPENAI_API_KEY`/`OPENAI_MODEL`, `GROQ_API_KEY`/`GROQ_MODEL`, and `DEEPSEEK_API_KEY`/`DEEPSEEK_MODEL`. Additional same-provider keys can be configured as numbered variables such as `gemini1`, `gemini2`, `deep1`, `deep2` (or `deepseek1`, `deepseek2`). Optional endpoint overrides are `OPENROUTER_BASE_URL`, `OPENAI_BASE_URL`, `GROQ_BASE_URL`, and `DEEPSEEK_BASE_URL`; `EXABOT_TIMEOUT_MS` controls the request timeout. Free-tier limits and model availability vary; paid model use may incur charges. Never expose API keys in the frontend.

Free hosting is not a guarantee of a fully free, persistent production stack. Render's free web service can sleep after inactivity and has ephemeral storage; uploaded files under `/app/uploads` are not durable there. Northflank's free plan has limited service slots and resource allowance. Both options need an external, private MySQL database, and its pricing/retention is separate from the application host. Review current limits before storing real student data.

The backend uses Flyway migrations and `ddl-auto: validate` by default. Allow the service to complete migrations at startup. Both hosts provide `PORT` at runtime; the app binds to it and its health check is `/api/actuator/health`.

## Oracle Cloud Always Free VM (self-managed MySQL)

To keep MySQL compatible without a separate database subscription, run MySQL 8 and the Spring Boot API together on an [Oracle Cloud Always Free Compute VM](https://www.oracle.com/cloud/free/). This is self-managed: you are responsible for VM security, updates, database backups, and checking current OCI capacity and Always Free eligibility. Oracle may reclaim idle Always Free instances under its [published policy](https://docs.oracle.com/en-us/iaas/Content/Compute/References/idle-instance-reclamation.htm); do not treat this as guaranteed production hosting.

1. Install Terraform, create/configure an OCI API key using the [OCI CLI setup guide](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm), and make sure the CLI's `DEFAULT` profile in `~/.oci/config` can access the compartment. The Terraform provider reads that profile. OCI may require account verification and payment details; complete those directly with Oracle and confirm the VM/boot-volume resources are eligible for Always Free in your tenancy and region.
2. Create an SSH key pair locally if you do not already have one. Find your public IPv4 address and use it as a `/32` CIDR so SSH is not open to the internet. In Windows PowerShell, from the repository root:

   ```powershell
   New-Item -ItemType Directory -Force "$HOME\.ssh"
   ssh-keygen -t ed25519 -f "$HOME\.ssh\exa_oci"
   Get-Content "$HOME\.ssh\exa_oci.pub"
   Copy-Item .\infra\oci\terraform.tfvars.example .\infra\oci\terraform.tfvars
   ```

   Edit `infra\oci\terraform.tfvars` with the compartment OCID from OCI, your public IP in `/32` form, and the complete SSH public key printed above. The example is tracked; the real tfvars file is git-ignored.

   ```hcl
   compartment_ocid   = "ocid1.compartment.oc1..your-value"
   ssh_source_cidr    = "203.0.113.10/32"
   ssh_authorized_key = "ssh-ed25519 AAAA... your-key"
   ```

   Create the instance and its private-by-default network:

   ```powershell
   terraform -chdir=infra/oci init
   terraform -chdir=infra/oci plan
   terraform -chdir=infra/oci apply
   $vmIp = terraform -chdir=infra/oci output -raw instance_public_ip
   ssh -i "$HOME\.ssh\exa_oci" "ubuntu@$vmIp" "cloud-init status --wait"
   ```

   Review the plan before applying. Defaults use 2 OCPUs, 12 GiB RAM, and a 100 GiB boot volume; the module constrains these values to the A1 monthly free-tier and boot-volume limits, but existing tenancy usage, region capacity, and eligibility can still affect charges or prevent creation. Only SSH from the CIDR you set is allowed inbound; MySQL and the backend have no public listener. Cloud-init installs Docker and checks out the application. Wait for cloud-init to finish before proceeding.
3. Create a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) and add a published application route for `api.your-domain.example` to `http://backend:8080`. Copy the tunnel token privately; do not put it in user-data or source control.
4. On your own computer, copy `.env.oci.example` to `.env.oci`, replace its placeholder passwords/JWT secret with unique values, and save the Cloudflare Tunnel token in a separate `.cloudflare-tunnel-token` file. Generate each secret locally (for example with `openssl rand -hex 32` in Git Bash); never reuse the examples. Then, in Windows PowerShell:

   ```powershell
   Copy-Item .env.oci.example .env.oci
   $token = Read-Host "Cloudflare Tunnel token"
   [IO.File]::WriteAllText((Join-Path $PWD ".cloudflare-tunnel-token"), $token)
   Remove-Variable token
   icacls .env.oci /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
   icacls .cloudflare-tunnel-token /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
   $vmIp = terraform -chdir=infra/oci output -raw instance_public_ip
   scp -i "$HOME\.ssh\exa_oci" .env.oci .cloudflare-tunnel-token "ubuntu@${vmIp}:"
   ssh -i "$HOME\.ssh\exa_oci" "ubuntu@$vmIp" "sudo install -o root -g root -m 600 /home/ubuntu/.env.oci /opt/exa/.env.oci && sudo install -o root -g root -m 600 /home/ubuntu/.cloudflare-tunnel-token /opt/exa/.cloudflare-tunnel-token && rm /home/ubuntu/.env.oci /home/ubuntu/.cloudflare-tunnel-token && sudo exa-deploy"
   ```

   The `ubuntu` username applies to the selected Ubuntu image. Keep both local secret files private; they are ignored by Git. Compose mounts the tunnel token as a secret and passes its file path to `cloudflared`, rather than placing the token in container arguments or environment.
5. In Cloudflare Pages, set `VITE_API_URL=https://api.your-domain.example/api` and redeploy the frontend. `CORS_ORIGINS` should contain the browser's Pages origin (`https://exa-edulab.pages.dev`), not the API hostname.
6. To deploy later source changes, pull them on the VM and rerun `sudo exa-deploy`:

   ```sh
   cd /opt/exa
   sudo git pull --ff-only
   sudo exa-deploy
   ```

7. Back up the database regularly to storage outside this VM and test restoring it. The VM's attached storage and Docker volumes are not a substitute for off-instance backups. For example, create a one-off SQL dump without exposing a host port:

   ```sh
   cd /opt/exa
   sudo docker compose --env-file .env.oci -f docker-compose.oci.yml exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > exa-backup.sql
   ```

   When retiring the VM, use `terraform destroy` from `infra/oci` after copying any needed backups off-instance. Terraform state is local and is ignored by Git; keep it private and backed up because it records the created resource IDs.

   Copy the dump off the VM and protect it as sensitive student data. Do not leave backups in a public web directory.

This Oracle setup replaces both the external backend host and database host. The MySQL service has no published host port; the API is reachable only through Cloudflare Tunnel. Database backups must be copied off the VM and protected as sensitive student data.

AI import accepts TXT, DOCX, PDF, XLSX, XLS, PNG, JPG/JPEG, and WEBP files up to 20MB; images and scanned PDFs are limited to 15MB. The import flow supports extracting existing questions and generating questions from arbitrary source content, notes, short topics, tables, facts, or natural-language requests. Generated questions do not require a preformatted exam or existing questions; teachers can paste plain text directly.
Question formulas render in previews, the question bank, and exams using `$...$` or `\(...\)` for mathematics and KaTeX mhchem syntax such as `$\ce{H2O}$` for chemistry.
Teachers can attach PNG, JPEG, or WEBP images of up to 5MB to questions and multiple-choice options. These media are stored in the MySQL database by the `V7__question_images.sql` migration; include them in normal database backup and retention procedures.

Never add real credentials to `.env.example`, frontend variables, source code, or deployment manifests committed to the repository. Rotate any credential that has been exposed.
