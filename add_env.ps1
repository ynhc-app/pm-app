$envUrl = "postgresql://postgres.pgcyyklswwespizxfzft:Ynh46%23ynh46@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
Write-Output $envUrl | vercel env add DATABASE_URL production
Write-Output $envUrl | vercel env add DATABASE_URL preview
Write-Output $envUrl | vercel env add DATABASE_URL development
