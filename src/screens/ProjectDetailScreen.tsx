import React from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DocumentPicker, {types} from 'react-native-document-picker';
import {PrimaryButton} from '../components/PrimaryButton';
import {useAppStore} from '../store/useAppStore';
import {exportProjectPages} from '../utils/export';

type Props = {
  projectId: string;
  onBack: () => void;
  onOpenEditor: (pageId: string) => void;
};

const STRINGS = {
  overLimitTitle: '已超上限',
  overLimitMessage: '单项目最多 50 页，超出部分已忽略',
  importFailTitle: '导入失败',
  importFailMessage: '请选择图片后重试',
  emptyTitle: '暂无页面',
  emptyMessage: '请先导入图片',
  exportDoneTitle: '导出完成',
};

export function ProjectDetailScreen({projectId, onBack, onOpenEditor}: Props) {
  const project = useAppStore(state =>
    state.projects.find(item => item.id === projectId),
  );
  const importPages = useAppStore(state => state.importPages);

  if (!project) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <PrimaryButton title="返回" onPress={onBack} />
        <Text style={styles.title}>{project.name}</Text>
        <View style={styles.actions}>
          <PrimaryButton
            title="导入"
            onPress={() => {
              (async () => {
                try {
                  const files = await DocumentPicker.pick({
                    allowMultiSelection: true,
                    type: [types.images],
                    copyTo: 'documentDirectory',
                  });
                  const uris = files
                    .map(file => file.fileCopyUri || file.uri)
                    .filter((item): item is string => Boolean(item));
                  const result = await importPages(projectId, uris);
                  if (result.blocked) {
                    Alert.alert(
                      STRINGS.overLimitTitle,
                      STRINGS.overLimitMessage,
                    );
                  }
                } catch (error: unknown) {
                  if (!DocumentPicker.isCancel(error)) {
                    Alert.alert(
                      STRINGS.importFailTitle,
                      STRINGS.importFailMessage,
                    );
                  }
                }
              })().catch(() => undefined);
            }}
          />
          <PrimaryButton
            title="导出"
            onPress={() => {
              (async () => {
                if (project.pages.length === 0) {
                  Alert.alert(STRINGS.emptyTitle, STRINGS.emptyMessage);
                  return;
                }
                const dir = await exportProjectPages(project);
                Alert.alert(STRINGS.exportDoneTitle, dir);
              })().catch(() => undefined);
            }}
          />
        </View>
      </View>

      <FlatList
        data={project.pages}
        numColumns={3}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.col}
        renderItem={({item}) => (
          <Pressable style={styles.card} onPress={() => onOpenEditor(item.id)}>
            <Image
              style={styles.thumb}
              source={{uri: `file://${item.imagePath}`}}
              resizeMode="cover"
            />
            <Text style={styles.pageText}>
              {item.texts.length} 文本 · {item.strokes.length} 笔
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f4f4f4'},
  header: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 8,
  },
  title: {fontSize: 16, fontWeight: '700', color: '#111'},
  actions: {flexDirection: 'row', gap: 8},
  grid: {padding: 8, gap: 8},
  col: {gap: 8},
  card: {
    flex: 1 / 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 6,
    gap: 4,
  },
  thumb: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: 6,
    backgroundColor: '#ddd',
  },
  pageText: {fontSize: 11, color: '#555'},
});
