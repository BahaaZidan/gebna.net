## TODOs

### Backend

- [x] Drop JMAP (I ended up deleting everything)
- [x] Better structure
- [x] Rework authentication
- [x] Redo the database design around a simpler single-user method
- [x] Redo the inbound worker code to reflect the new design
- [x] Sanitize PostalMime.Email.html
- [x] Parse PostalMime.Email.references into an array of addresses instead of the raw string
- [ ] Manually Test inbound again
- [ ] Attachments
- [ ] LLM-generate a test script for inbound including threads
- [ ] Cron to delete emails that has been in a trash mailbox for more than (?) days
- [ ] Setup graphql-yoga with hono
- [ ] Stitch existing authentication with the graphql-yoga instance
- [ ] Setup server codegen for GQL typesafety
- [ ] Query to list threads
- [ ] Query to view thread(s?) detail
- [ ] Check constraint to make sure the user have at least one trash, important, news, and paper trail box

### Web UI

- [ ] Research using react-native for the web ui SPA and mobile 😢
- [ ] Research capacitor limitations

### Only after Web UI v0

- [ ] Database indexing based on the queries web ui is using

### Beyond v0

- [ ] Store raw .eml in an R2 bucket
