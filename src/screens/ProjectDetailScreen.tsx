import React from 'react';
import {Alert, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import DocumentPicker, {types} from 'react-native-document-picker';
import {PrimaryButton} from '../components/PrimaryButton';
import {useAppStore} from '../store/useAppStore';
import {exportProjectPages} from '../utils/export';

type Props = {
  projectId: string;
  onBack: () => void;
  onOpenEditor: (pageId: string) => void;
};

export function ProjectDetailScreen({projectId, onBack, onOpenEditor}: Props) {
  const project = useAppStore(state => state.projects.find(item => item.id === projectId));
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
              void (async () => {
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
                    Alert.alert('已超上限', '单项目最多 50 页，超出部分已忽略');
                  }
                } catch (error: unknown) {
                  if (!DocumentPicker.isCancel(error)) {
                    Alert.alert('导入失败', '请选择图片后重试');
                  }
                }
              })();
            }}
          />
          <PrimaryButton
            title="导出"
            onPress={() => {
              void (async () => {
                if (project.pages.length === 0) {
                  Alert.alert('暂无页面', '请先导入图片');
                  return;
                }
                const dir = await exportProjectPages(project);
                Alert.alert('导出完成', dir);
              })();
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
            <Image style={styles.thumb} source={{uri: `file://${item.imagePath}`}} resizeMode="cover" />
            <Text style={styles.pageText}>{item.texts.length} 文本 · {item.strokes.length} 笔</Text>
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
  card: {flex: 1 / 3, backgroundColor: '#fff', borderRadius: 8, padding: 6, gap: 4},
  thumb: {width: '100%', aspectRatio: 0.7, borderRadius: 6, backgroundColor: '#ddd'},
  pageText: {fontSize: 11, color: '#555'},
});
