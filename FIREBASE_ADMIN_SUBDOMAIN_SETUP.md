## Admin subdomain split

Current production-ready split in this project:

- Public site: `rahma-al-muhdah.vercel.app`
- Admin app: `rahma-al-muhdah.vercel.app/admin-dashboard/`
- Optional company portal: `rahma-al-muhdah.vercel.app/company-auth/`

Current URLs:

- `https://rahma-al-muhdah.vercel.app/`
- `https://rahma-al-muhdah.vercel.app/admin-dashboard/`

Suggested custom-domain mapping later:

- `https://your-domain.com/`
- `https://admin.your-domain.com/`

## 1. Hosting targets already used

```bash
firebase target:apply hosting public rahma-al-muhdah-c0430
firebase target:apply hosting admin rahma-al-muhdah-admin
```

Your `.firebaserc` contains a `targets` block similar to:

```json
{
  "projects": {
    "default": "rahma-al-muhdah-c0430"
  },
  "targets": {
    "rahma-al-muhdah-c0430": {
      "hosting": {
        "public": [
          "rahma-al-muhdah-c0430"
        ],
        "admin": [
          "rahma-al-muhdah-admin"
        ]
      }
    }
  }
}
```

## 2. Deploy split hosting

```bash
firebase deploy --only hosting:public,hosting:admin
```

## 3. Connect custom domains

From Firebase Console:

1. Open Hosting
2. Select each site
3. Add custom domain
4. Map:
   - public site -> main domain
   - admin site -> `admin.your-domain.com`

## Notes

- This is stronger isolation than hiding admin pages inside the same public root.
- The public hosting config now excludes old admin pages and the admin build entirely.
- The admin app is deployed from `al-rahma-recruitment-admin/dist` into the `/admin-dashboard/` route on Vercel.
