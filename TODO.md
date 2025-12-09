## TODOs

### v0

- [x] Drop JMAP (I ended up deleting everything)
- [x] Better structure
- [x] Rework authentication
- [x] Redo the database design around a simpler single-user method
- [x] Redo the inbound worker code to reflect the new design
- [x] Sanitize PostalMime.Email.html
- [x] Parse PostalMime.Email.references into an array of addresses instead of the raw string
- [x] Manually Test inbound again
- [x] Attachments
- [x] Setup graphql-yoga with hono
- [x] Setup server codegen for GQL typesafety
- [x] Watch and run codegen
- [x] Stitch existing authentication with the graphql-yoga instance
- [x] Rough graphql schema draft
- [x] Resolvers for the rough schema draft
- [x] Mailbox.threads
- [x] Mailbox.unreadThreadsCount
- [x] Query to view thread(s?) detail
- [x] Basic UI layout
- [x] Basic login/signup UI
- [ ] Research capacitor limitations
- [ ] Research using react-native for the web ui SPA and mobile 😢
- [ ] Check constraint to make sure the user have at least one trash, important, news, and paper trail box
- [ ] LLM-generate a test script for inbound including threads
- [ ] Cron to delete emails that has been in a trash mailbox for more than (?) days
- [ ] Downloadable attachments
- [ ] The ability to change your name
- [ ] The ability to add a profile picture
- [ ] Storing the profile pictures and names of addresses
- [ ] User.mailboxes should be filtered based on an array of types (i.e. ["important", "screener"])
- [ ] Tighter security by creating machine id for every session and checking against it pre usage

### v0.5

- [ ] Database indexing based on the queries web ui is using

### Beyond v0.5

- [ ] Store raw .eml in an R2 bucket
- [ ] Reply later
- [ ] Focus & reply (a dedicated page to reply to all emails user marked as reply later)
- [ ] Every address gets a dedicated page where a user can see all the email threads sent/recieved between the address and the user. You can also see the files/attachments. Finally, you're able to change where their future emails go.
- [ ] The user should be able edit the subject of a thread
- [ ] Merge threads together
- [ ] Attachments standalone page. Search per filetype or sender across all attachments tied to your account
- [ ] The ability to ignore specific threads. (i.e. new messages from the thread will be marked as read)
- [ ] Block pixel tracking
- [ ] Attachment previews
- [ ] Users can forward their old emails to Gebna
- [ ] Users can forward their Gebna emails to their old emails.
- [ ] Keyboard shortcuts on desktop
- [ ] Users can anottate a thread with "note to self". Things like "don't forget to ask them about X if they don't bring it up!"
- [ ] Labels
- [ ] Set aside
- [ ]
