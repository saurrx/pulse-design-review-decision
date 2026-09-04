# Behavioural fingerprint differences

These escalate the record to behaviour-impact approval.

## src/components/DashboardLayout.tsx
- permission: added ["title: role === \"INVENTOR\" ? \"Your invention workspace\" : role === \"LEGAL_COUNSEL\" ? \"Overview\" : \"Portfolio overview\","] removed ["title: role === \"INVENTOR\" ? \"Your invention workspace\" : \"Portfolio overview\","]

## src/components/TopInventors.tsx
- props: added ["TopInventorsProps.empty","TopInventorsProps.error","TopInventorsProps.loading","TopInventorsProps.periods","TopInventorsProps.v0"] removed []

## src/components/dashboard/WorkspaceAdminOverview.tsx
- api: added ["GET /api/v1/dashboard","GET /api/v1/idea/fetch-by-user?page=1&limit=100&status={x}","GET /api/v1/idea/pipeline"] removed []
- queryKeys: added ["\"dashboard\",scope","\"dashboard_ideas\",scope,false","\"dashboard_pipeline\",scope"] removed []
- navigation: added ["/ideas/${id}","/ideas?search=${encodeURIComponent(e.name)}","/ideas?status=${REVIEW_STATUS}","/patents?jurisdiction=${encodeURIComponent(j)}","/patents?status=ACTIVE_GRANTED","/workspace"] removed []
- vocabulary: added ["FILED","SEND_TO_OC","SENT_TO_IHC","UNDER_REVIEW"] removed []

## src/pages/Index.tsx
- vocabulary: added ["LEGAL_COUNSEL"] removed []
- permission: added ["if (user?.role === \"LEGAL_COUNSEL\") return <WorkspaceAdminOverview />;"] removed []
