param(
    [Parameter(Mandatory = $false)]
    [string]$Repo = "anton5267/Chess-master55",

    [Parameter(Mandatory = $false)]
    [string]$Branch = "main",

    [Parameter(Mandatory = $false)]
    [string]$AppRegistrationName = "github-actions-chess-master55",

    [Parameter(Mandatory = $false)]
    [string]$WebAppName,

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroup,

    [Parameter(Mandatory = $false)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [string]$TenantId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Ensure-Command {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Ensure-ScopedLogin {
    param(
        [string]$Scope,
        [string]$Hint
    )

    try {
        az account get-access-token --scope $Scope --output none | Out-Null
    }
    catch {
        throw "Azure token for scope '$Scope' is missing. Run: az login --scope $Scope $Hint"
    }
}

function Ensure-RoleAssignment {
    param(
        [string]$Assignee,
        [string]$Scope,
        [string]$RoleName
    )

    $roleExists = az role assignment list `
        --assignee $Assignee `
        --scope $Scope `
        --query "[?roleDefinitionName=='$RoleName'] | length(@)" `
        -o tsv

    if ($roleExists -eq "0") {
        az role assignment create `
            --assignee $Assignee `
            --role $RoleName `
            --scope $Scope `
            --output none | Out-Null
    }
}

Ensure-Command "az"
Ensure-Command "gh"

Write-Step "Validating Azure and GitHub authentication"
az account show --output none | Out-Null
gh auth status | Out-Null

Ensure-ScopedLogin -Scope "https://management.core.windows.net//.default" -Hint "--use-device-code"
Ensure-ScopedLogin -Scope "https://graph.microsoft.com//.default" -Hint "--use-device-code"

if ($SubscriptionId) {
    Write-Step "Selecting subscription $SubscriptionId"
    az account set --subscription $SubscriptionId
}

$account = az account show --output json | ConvertFrom-Json

if (-not $SubscriptionId) {
    $SubscriptionId = $account.id
}

if (-not $TenantId) {
    $TenantId = $account.tenantId
}

Write-Step "Resolving target Web App"
$webApps = az webapp list --query "[].{name:name,rg:resourceGroup,host:defaultHostName,id:id}" --output json | ConvertFrom-Json

if (-not $WebAppName -or -not $ResourceGroup) {
    $candidates = $webApps
    if ($WebAppName) {
        $candidates = $candidates | Where-Object { $_.name -eq $WebAppName }
    }

    if ($ResourceGroup) {
        $candidates = $candidates | Where-Object { $_.rg -eq $ResourceGroup }
    }

    if (-not $candidates -or $candidates.Count -eq 0) {
        throw "No Web Apps matched. Provide -WebAppName and -ResourceGroup explicitly."
    }

    if ($candidates.Count -gt 1 -and (-not $WebAppName -or -not $ResourceGroup)) {
        $table = $candidates | Select-Object name, rg, host | Format-Table | Out-String
        throw "Multiple Web Apps found. Specify -WebAppName and -ResourceGroup.`n$table"
    }

    $selected = $candidates | Select-Object -First 1
    $WebAppName = $selected.name
    $ResourceGroup = $selected.rg
}

$webApp = az webapp show `
    --name $WebAppName `
    --resource-group $ResourceGroup `
    --query "{id:id,host:defaultHostName}" `
    --output json | ConvertFrom-Json

$webAppId = $webApp.id
$webAppUrl = "https://$($webApp.host)"

Write-Step "Ensuring App Registration '$AppRegistrationName'"
$app = az ad app list --display-name $AppRegistrationName --query "[0]" --output json | ConvertFrom-Json

if (-not $app) {
    $app = az ad app create --display-name $AppRegistrationName --output json | ConvertFrom-Json
}

$appObjectId = $app.id
$appClientId = $app.appId

Write-Step "Ensuring Service Principal exists"
$sp = az ad sp list --filter "appId eq '$appClientId'" --query "[0]" --output json | ConvertFrom-Json
if (-not $sp) {
    az ad sp create --id $appClientId --output none | Out-Null
}

Write-Step "Ensuring GitHub federated credential"
$federatedName = "github-$Branch"
$federatedExists = az ad app federated-credential list `
    --id $appObjectId `
    --query "[?name=='$federatedName'] | length(@)" `
    --output tsv

if ($federatedExists -eq "0") {
    $tmpFile = [System.IO.Path]::GetTempFileName()
    try {
        @{
            name = $federatedName
            issuer = "https://token.actions.githubusercontent.com"
            subject = "repo:$Repo:ref:refs/heads/$Branch"
            audiences = @("api://AzureADTokenExchange")
        } | ConvertTo-Json -Depth 5 | Set-Content -Path $tmpFile -Encoding UTF8

        az ad app federated-credential create --id $appObjectId --parameters "@$tmpFile" --output none | Out-Null
    }
    finally {
        Remove-Item -Path $tmpFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Step "Ensuring Contributor role on Web App scope"
Ensure-RoleAssignment -Assignee $appClientId -Scope $webAppId -RoleName "Contributor"

Write-Step "Writing GitHub secrets and variable"
gh secret set AZURE_CLIENT_ID --repo $Repo --body $appClientId
gh secret set AZURE_TENANT_ID --repo $Repo --body $TenantId
gh secret set AZURE_SUBSCRIPTION_ID --repo $Repo --body $SubscriptionId
gh secret set AZURE_WEBAPP_URL --repo $Repo --body $webAppUrl
gh variable set AZURE_WEBAPP_NAME --repo $Repo --body $WebAppName

Write-Step "Completed"
Write-Host "Repo: $Repo"
Write-Host "Web App: $WebAppName"
Write-Host "Resource Group: $ResourceGroup"
Write-Host "URL: $webAppUrl"
Write-Host "Client ID: $appClientId"
Write-Host "Branch subject: repo:$Repo:ref:refs/heads/$Branch"
