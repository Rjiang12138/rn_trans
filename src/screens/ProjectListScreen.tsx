import React, {useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {useAppStore} from '../store/useAppStore';
import {PrimaryButton} from '../components/PrimaryButton';

type Props = {
  onOpenProject: (projectId: string) => void;
};

export function ProjectListScreen({onOpenProject}: Props) {
  const projects = useAppStore(state => state.projects);
  const createProject = useAppStore(state => state.createProject);
  const deleteProject = useAppStore(state => state.deleteProject);
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');

  const sorted = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt - a.updatedAt),
    [projects],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>漫画翻译项目</Text>
        <PrimaryButton title="新建" onPress={() => setOpenModal(true)} />
      </View>
      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <Pressable style={styles.item} onPress={() => onOpenProject(item.id)}>
            <View style={styles.itemTextWrap}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.meta}>{item.pages.length} 页</Text>
            </View>
            <PrimaryButton
              title="删除"
              onPress={() =>
                Alert.alert('删除项目', `确认删除 ${item.name}？`, [
                  {text: '取消', style: 'cancel'},
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                      deleteProject(item.id).catch(() => undefined);
                    },
                  },
                ])
              }
            />
          </Pressable>
        )}
      />

      <Modal
        visible={openModal}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>新建项目</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="输入项目名"
            />
            <View style={styles.row}>
              <PrimaryButton
                title="取消"
                onPress={() => setOpenModal(false)}
                style={styles.flex}
              />
              <PrimaryButton
                title="确定"
                style={styles.flex}
                onPress={() => {
                  (async () => {
                    const projectId = await createProject(name);
                    if (!projectId) {
                      return;
                    }
                    setName('');
                    setOpenModal(false);
                    onOpenProject(projectId);
                  })().catch(() => undefined);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f4f4f4'},
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  title: {fontSize: 18, fontWeight: '700', color: '#111'},
  list: {padding: 10, gap: 10},
  item: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTextWrap: {gap: 6},
  itemName: {fontSize: 16, fontWeight: '600', color: '#111'},
  meta: {fontSize: 12, color: '#666'},
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#111'},
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  row: {flexDirection: 'row', gap: 8},
  flex: {flex: 1},
});
