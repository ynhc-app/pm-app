$envUrl = "postgresql://postgres.pgcyyklswwespizxfzft:Ynh46%23ynh46@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
vercel --prod --yes -e DATABASE_URL=$envUrl -b DATABASE_URL=$envUrl
