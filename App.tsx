import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StatusBar, View} from 'react-native';
import {ProjectListScreen} from './src/screens/ProjectListScreen';
import {ProjectDetailScreen} from './src/screens/ProjectDetailScreen';
import {EditorScreen} from './src/screens/EditorScreen';
import {useAppStore} from './src/store/useAppStore';

type Route =
  | {name: 'projects'}
  | {name: 'project'; projectId: string}
  | {name: 'editor'; projectId: string; pageId: string};

function App(): React.JSX.Element {
  const hydrate = useAppStore(state => state.hydrate);
  const hydrated = useAppStore(state => state.hydrated);
  const [route, setRoute] = useState<Route>({name: 'projects'});

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const content = useMemo(() => {
    if (route.name === 'projects') {
      return <ProjectListScreen onOpenProject={projectId => setRoute({name: 'project', projectId})} />;
    }
    if (route.name === 'project') {
      return (
        <ProjectDetailScreen
          projectId={route.projectId}
          onBack={() => setRoute({name: 'projects'})}
          onOpenEditor={pageId => setRoute({name: 'editor', projectId: route.projectId, pageId})}
        />
      );
    }
    return (
      <EditorScreen
        projectId={route.projectId}
        pageId={route.pageId}
        onBack={() => setRoute({name: 'project', projectId: route.projectId})}
      />
    );
  }, [route]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f4f4" />
      {!hydrated ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator />
        </View>
      ) : (
        content
      )}
    </>
  );
}

export default App;
