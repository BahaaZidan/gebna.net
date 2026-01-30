# TODOs

## proto-3

### BIG

- [ ] Chats => A unified chat interface
  - [ ] Smart content detection:
    - [ ] Calendar invites
    - [ ] Body-less emails w/ attachments
- [ ] Calendar
- [ ] News => Email newsletters + RSS = unified news feed
- [ ] Files => Generic cloud storage that also includes attachments

### smol

- [ ] generate snippets on the resolvers level
- [ ] store snippet in the database
- [ ]

## v0.5

- [ ] Show thread participants in thread details page.
- [ ] Mark as seen / Mark as unseen in /app/mail
- [ ] Pagination

## Beyond v0.5

- [ ] Dataloaders everywhere
- [ ] Database indexing based on the queries web ui is using

## v0.6

- [ ] Email Outbound

## Beyond v1

- [ ] Offline support
- [ ] Custom domain support
- [ ] Tighter security by creating machine id for every session and checking against it pre usage
- [ ] Users can forward their old emails to Gebna
- [ ] Users can forward their Gebna emails to their old emails.
- [ ] Keyboard shortcuts on desktop.
- [ ] use svelte boundaries to show a graceful error message in case of an exception
- [ ] Attachment previews

## ?

- [ ] Store raw .eml in an R2 bucket
- [ ] Labels
- [ ] Workflows ?
- [ ] Integrations/apps ?
- [ ] Use a scalar to automatically unwrap input IDs on the schema level so that you don't have to litter resolver code with `fromGlobalId(args.id).id`
- [ ] The ability to select a substring from the email body and save it for later reference. (in Hey it's called Clips. I don't think it's useful enough in Hey. I think it would be really cool to have that as a continuity feature with gebna notes.)
- [ ] Strip bodyMD from anything but the innerHTML of <body>

## Renames

- [ ] read/unread -> seen/unseen

## BUGS

- [ ] probably houdini: in MessageAddedSubscription even though the backend socket is working fine, the store only ever appends messages to the conversation it subscribed to first.
- [ ] probably houdini: in MessageAddedSubscription if you have a mutation and a subscription that are both trying to append on response to the same list/pagination, you'll run into some weird behaviour where things from subscription are often never appended and the ordering of the list is messed up.
