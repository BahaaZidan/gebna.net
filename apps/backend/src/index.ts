import { createSchema, createYoga } from 'graphql-yoga';
import schemaSDL from '../../../schema.graphql?raw';

type Env = Record<string, never>;

const yoga = createYoga<Env>({
  schema: createSchema({
    typeDefs: schemaSDL,
    resolvers: {
      Query: {
        viewer: () => ({
          id: 'viewer-1',
          username: 'gebna',
          name: 'Gebna User',
          avatar: 'https://placehold.co/64x64',
          identity: {
            id: 'identity-1',
            address: 'user@gebna.net',
            kind: 'GEBNA_USER',
            avatar: 'https://placehold.co/48x48',
            relationshipToViewer: {
              id: 'rel-1',
              isContact: true,
              displayName: 'Gebna User',
              avatarUrl: 'https://placehold.co/48x48',
            },
          },
        }),
        node: (_parent, args: { id: string }) => ({
          id: args.id,
          __typename: 'Viewer',
          username: 'gebna',
          name: 'Gebna User',
          avatar: 'https://placehold.co/64x64',
          identity: {
            id: 'identity-1',
            address: 'user@gebna.net',
            kind: 'GEBNA_USER',
            avatar: 'https://placehold.co/48x48',
            relationshipToViewer: {
              id: 'rel-1',
              isContact: true,
              displayName: 'Gebna User',
              avatarUrl: 'https://placehold.co/48x48',
            },
          },
        }),
      },
    },
  }),
  graphqlEndpoint: '/graphql',
  fetchAPI: { Request, Response },
});

export default {
  fetch: yoga.fetch,
} satisfies ExportedHandler<Env>;
