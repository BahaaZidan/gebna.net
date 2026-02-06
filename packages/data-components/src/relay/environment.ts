import {
  Environment,
  FetchFunction,
  Network,
  RecordSource,
  Store,
} from 'relay-runtime';

const fetchFunction: FetchFunction = async (params) => {
  if (params.name === 'AppViewerGreetingQuery' || params.name === 'DesktopViewerGreetingQuery') {
    return {
      data: {
        viewer: {
          __typename: 'Viewer',
          id: 'viewer-1',
          name: 'Gebna User',
          username: 'gebna',
        },
      },
    };
  }

  return { data: {} };
};

export const createRelayEnvironment = () => {
  return new Environment({
    network: Network.create(fetchFunction),
    store: new Store(new RecordSource()),
  });
};
