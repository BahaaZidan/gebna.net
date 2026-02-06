import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
  }
  interface SafeAreaViewProps {
    className?: string;
  }
}
