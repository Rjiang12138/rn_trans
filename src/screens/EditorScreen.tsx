import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {Canvas, Group, Image as SkImageNode, Paragraph, Path, Skia, useImage} from '@shopify/react-native-skia';
import Slider from '@react-native-community/slider';
import {PrimaryButton} from '../components/PrimaryButton';
import {useAppStore} from '../store/useAppStore';
import type {PageData, TextItem} from '../types';
import {clonePage, createParagraph, estimateTextBounds, toSvgPath} from '../utils/page';
import {makeId} from '../utils/id';

type Props = {
  projectId: string;
  pageId: string;
  onBack: () => void;
};

type ToolMode = 'move' | 'draw' | 'text';

type TouchPoint = {x: number; y: number};

const COLORS = ['#ffffff', '#000000', '#ff4d4f', '#4f7bff'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function EditorScreen({projectId, pageId, onBack}: Props) {
  const updatePage = useAppStore(state => state.updatePage);
  const page = useAppStore(
    state => state.projects.find(project => project.id === projectId)?.pages.find(item => item.id === pageId),
  );

  const [pageState, setPageState] = useState<PageData | null>(page ? clonePage(page) : null);
  const [mode, setMode] = useState<ToolMode>('move');
  const [showOverlay, setShowOverlay] = useState(true);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(24);
  const [canvasSize, setCanvasSize] = useState({width: 1, height: 1});
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({x: 0, y: 0});
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [activeStroke, setActiveStroke] = useState<TouchPoint[]>([]);

  const [past, setPast] = useState<PageData[]>([]);
  const [future, setFuture] = useState<PageData[]>([]);

  const interactionRef = useRef<{
    type: 'none' | 'pan' | 'pinch' | 'draw' | 'textDrag';
    startOffset: {x: number; y: number};
    startZoom: number;
    startDistance: number;
    startCenter: TouchPoint;
    selectedTextId: string | null;
    beforeDrag: PageData | null;
    moved: boolean;
    targetTextId: string | null;
  }>({
    type: 'none',
    startOffset: {x: 0, y: 0},
    startZoom: 1,
    startDistance: 0,
    startCenter: {x: 0, y: 0},
    selectedTextId: null,
    beforeDrag: null,
    moved: false,
    targetTextId: null,
  });

  useEffect(() => {
    if (page) {
      setPageState(clonePage(page));
      setPast([]);
      setFuture([]);
      setActiveStroke([]);
    }
  }, [page]);

  const image = useImage(pageState ? `file://${pageState.imagePath}` : undefined);

  const fitScale = useMemo(() => {
    if (!pageState) {
      return 1;
    }
    return Math.min(canvasSize.width / pageState.width, canvasSize.height / pageState.height);
  }, [canvasSize.height, canvasSize.width, pageState]);

  useEffect(() => {
    if (!pageState) {
      return;
    }
    const s = fitScale;
    setZoom(1);
    setOffset({
      x: (canvasSize.width - pageState.width * s) / 2,
      y: (canvasSize.height - pageState.height * s) / 2,
    });
  }, [fitScale, pageState?.id, canvasSize.height, canvasSize.width]);

  useEffect(() => {
    if (!pageState) {
      return;
    }
    const timer = setTimeout(() => {
      void updatePage(projectId, pageState);
    }, 260);
    return () => clearTimeout(timer);
  }, [pageState, projectId, updatePage]);

  if (!pageState) {
    return null;
  }

  const totalScale = fitScale * zoom;

  const toImagePoint = (x: number, y: number): TouchPoint => ({
    x: (x - offset.x) / totalScale,
    y: (y - offset.y) / totalScale,
  });

  const addHistory = (snapshot: PageData) => {
    setPast(prev => [...prev.slice(-49), clonePage(snapshot)]);
    setFuture([]);
  };

  const updateLocalPage = (next: PageData) => {
    setPageState(next);
  };

  const undo = () => {
    if (past.length === 0) {
      return;
    }
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([clonePage(pageState), ...future]);
    setPageState(clonePage(prev));
  };

  const redo = () => {
    if (future.length === 0) {
      return;
    }
    const [next, ...rest] = future;
    setFuture(rest);
    setPast([...past, clonePage(pageState)]);
    setPageState(clonePage(next));
  };

  const beginEditText = (item: TextItem) => {
    setEditingTextId(item.id);
    setEditingTextValue(item.text);
  };

  const saveText = () => {
    if (!editingTextId) {
      return;
    }
    addHistory(pageState);
    updateLocalPage({
      ...pageState,
      texts: pageState.texts.map(item =>
        item.id === editingTextId ? {...item, text: editingTextValue} : item,
      ),
    });
    setEditingTextId(null);
    setEditingTextValue('');
  };

  const resolveTouch = (event: GestureResponderEvent): TouchPoint[] => {
    const touches = event.nativeEvent.touches;
    if (!touches.length) {
      return [{x: event.nativeEvent.locationX, y: event.nativeEvent.locationY}];
    }
    return Array.from(touches).map(t => ({x: t.locationX, y: t.locationY}));
  };

  const findTextHit = (point: TouchPoint) =>
    pageState.texts.find(item => {
      const box = estimateTextBounds(item);
      return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
    });

  const onResponderGrant = (event: GestureResponderEvent) => {
    const touches = resolveTouch(event);
    interactionRef.current.moved = false;

    if (touches.length >= 2) {
      const p1 = touches[0];
      const p2 = touches[1];
      const center = {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2};
      const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      interactionRef.current = {
        ...interactionRef.current,
        type: 'pinch',
        startOffset: offset,
        startZoom: zoom,
        startDistance: distance,
        startCenter: center,
      };
      return;
    }

    const screen = touches[0];
    const point = toImagePoint(screen.x, screen.y);

    if (mode === 'draw') {
      interactionRef.current.type = 'draw';
      setActiveStroke([point]);
      return;
    }

    if (mode === 'text') {
      const hit = findTextHit(point);
      interactionRef.current = {
        ...interactionRef.current,
        type: hit ? 'textDrag' : 'none',
        selectedTextId: hit?.id ?? null,
        targetTextId: hit?.id ?? null,
        beforeDrag: hit ? clonePage(pageState) : null,
      };
      return;
    }

    interactionRef.current = {
      ...interactionRef.current,
      type: 'pan',
      startOffset: offset,
      startCenter: screen,
    };
  };

  const onResponderMove = (event: GestureResponderEvent) => {
    const touches = resolveTouch(event);
    interactionRef.current.moved = true;

    if (interactionRef.current.type === 'pinch' && touches.length >= 2) {
      const p1 = touches[0];
      const p2 = touches[1];
      const center = {x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2};
      const distance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const ratio = distance / Math.max(1, interactionRef.current.startDistance);
      const nextZoom = clamp(interactionRef.current.startZoom * ratio, 0.5, 8);
      const prevScale = fitScale * interactionRef.current.startZoom;
      const nextScale = fitScale * nextZoom;

      const imagePoint = {
        x: (interactionRef.current.startCenter.x - interactionRef.current.startOffset.x) / prevScale,
        y: (interactionRef.current.startCenter.y - interactionRef.current.startOffset.y) / prevScale,
      };

      setZoom(nextZoom);
      setOffset({
        x: center.x - imagePoint.x * nextScale,
        y: center.y - imagePoint.y * nextScale,
      });
      return;
    }

    if (!touches.length) {
      return;
    }

    if (interactionRef.current.type === 'pan') {
      const t = touches[0];
      setOffset({
        x: interactionRef.current.startOffset.x + (t.x - interactionRef.current.startCenter.x),
        y: interactionRef.current.startOffset.y + (t.y - interactionRef.current.startCenter.y),
      });
      return;
    }

    if (interactionRef.current.type === 'draw') {
      const t = toImagePoint(touches[0].x, touches[0].y);
      setActiveStroke(prev => [...prev, t]);
      return;
    }

    if (interactionRef.current.type === 'textDrag' && interactionRef.current.selectedTextId) {
      const t = toImagePoint(touches[0].x, touches[0].y);
      updateLocalPage({
        ...pageState,
        texts: pageState.texts.map(item =>
          item.id === interactionRef.current.selectedTextId
            ? {
                ...item,
                x: t.x,
                y: t.y,
              }
            : item,
        ),
      });
    }
  };

  const onResponderRelease = (event: GestureResponderEvent) => {
    const touches = resolveTouch(event);
    const point = toImagePoint(touches[0]?.x ?? event.nativeEvent.locationX, touches[0]?.y ?? event.nativeEvent.locationY);

    if (interactionRef.current.type === 'draw' && activeStroke.length > 0) {
      addHistory(pageState);
      updateLocalPage({
        ...pageState,
        strokes: [
          ...pageState.strokes,
          {
            id: makeId(),
            color: brushColor,
            size: brushSize,
            points: activeStroke,
          },
        ],
      });
      setActiveStroke([]);
    }

    if (interactionRef.current.type === 'textDrag' && interactionRef.current.beforeDrag) {
      addHistory(interactionRef.current.beforeDrag);
      if (!interactionRef.current.moved && interactionRef.current.targetTextId) {
        const target = pageState.texts.find(item => item.id === interactionRef.current.targetTextId);
        if (target) {
          beginEditText(target);
        }
      }
    }

    if (mode === 'text' && !interactionRef.current.moved && !interactionRef.current.targetTextId) {
      const newText: TextItem = {
        id: makeId(),
        x: point.x,
        y: point.y,
        text: '译文',
        style: {
          color: '#000000',
          fontSize: 24,
          fontWeight: 'normal',
          letterSpacing: 0,
          lineHeight: 30,
        },
      };
      addHistory(pageState);
      updateLocalPage({...pageState, texts: [...pageState.texts, newText]});
      beginEditText(newText);
    }

    interactionRef.current = {
      ...interactionRef.current,
      type: 'none',
      selectedTextId: null,
      targetTextId: null,
      beforeDrag: null,
    };
  };

  const currentText = editingTextId
    ? pageState.texts.find(item => item.id === editingTextId) || null
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <PrimaryButton title="返回" onPress={onBack} />
        <Text style={styles.title}>编辑页</Text>
        <View style={styles.row}>
          <PrimaryButton title="撤销" onPress={undo} disabled={past.length === 0} />
          <PrimaryButton title="重做" onPress={redo} disabled={future.length === 0} />
        </View>
      </View>

      <View
        style={styles.canvasWrap}
        onLayout={e => {
          const {width, height} = e.nativeEvent.layout;
          setCanvasSize({width, height});
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onResponderGrant}
        onResponderMove={onResponderMove}
        onResponderRelease={onResponderRelease}>
        <Canvas style={styles.canvas}>
          <Group transform={[{translateX: offset.x}, {translateY: offset.y}, {scale: totalScale}]}>
            {image && (
              <SkImageNode
                image={image}
                x={0}
                y={0}
                width={pageState.width}
                height={pageState.height}
                fit="fill"
              />
            )}

            {showOverlay &&
              pageState.strokes.map(stroke => (
                <Path
                  key={stroke.id}
                  path={toSvgPath(stroke.points)}
                  style="stroke"
                  strokeWidth={stroke.size}
                  color={stroke.color}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ))}
            {showOverlay && activeStroke.length > 0 && (
              <Path
                path={toSvgPath(activeStroke)}
                style="stroke"
                strokeWidth={brushSize}
                color={brushColor}
                strokeCap="round"
                strokeJoin="round"
              />
            )}

            {pageState.texts.map(item => (
              <Paragraph key={item.id} paragraph={createParagraph(item)} x={item.x} y={item.y} width={360} />
            ))}
          </Group>
        </Canvas>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.row}>
          <PrimaryButton title="移动" onPress={() => setMode('move')} style={mode === 'move' && styles.activeBtn} />
          <PrimaryButton title="涂抹" onPress={() => setMode('draw')} style={mode === 'draw' && styles.activeBtn} />
          <PrimaryButton title="文本" onPress={() => setMode('text')} style={mode === 'text' && styles.activeBtn} />
          <PrimaryButton title={showOverlay ? '隐层' : '显层'} onPress={() => setShowOverlay(v => !v)} />
        </View>

        <View style={styles.row}>
          {COLORS.map(color => (
            <Pressable
              key={color}
              style={[styles.color, {backgroundColor: color}, brushColor === color && styles.colorActive]}
              onPress={() => setBrushColor(color)}
            />
          ))}
          <PrimaryButton
            title="自定义"
            onPress={() => {
              Alert.prompt?.('输入颜色', '支持 #RRGGBB', value => {
                if (value) {
                  setBrushColor(value);
                }
              });
            }}
          />
          <PrimaryButton
            title="回退一笔"
            onPress={() => {
              if (!pageState.strokes.length) {
                return;
              }
              addHistory(pageState);
              updateLocalPage({...pageState, strokes: pageState.strokes.slice(0, -1)});
            }}
            disabled={!pageState.strokes.length}
          />
        </View>

        <Text style={styles.meta}>画笔大小 {Math.round(brushSize)}</Text>
        <Slider
          minimumValue={4}
          maximumValue={120}
          step={1}
          value={brushSize}
          onValueChange={setBrushSize}
          minimumTrackTintColor="#111"
        />
      </View>

      <Modal visible={Boolean(currentText)} transparent animationType="slide" onRequestClose={() => setEditingTextId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>编辑文本</Text>
            <TextInput
              multiline
              style={styles.textInput}
              value={editingTextValue}
              onChangeText={setEditingTextValue}
              placeholder="输入译文"
            />
            {currentText && (
              <>
                <Text style={styles.meta}>字号 {Math.round(currentText.style.fontSize)}</Text>
                <Slider
                  minimumValue={12}
                  maximumValue={64}
                  step={1}
                  value={currentText.style.fontSize}
                  onValueChange={value =>
                    updateLocalPage({
                      ...pageState,
                      texts: pageState.texts.map(item =>
                        item.id === currentText.id
                          ? {
                              ...item,
                              style: {...item.style, fontSize: value},
                            }
                          : item,
                      ),
                    })
                  }
                />
                <Text style={styles.meta}>字间距 {currentText.style.letterSpacing.toFixed(1)}</Text>
                <Slider
                  minimumValue={-1}
                  maximumValue={8}
                  step={0.5}
                  value={currentText.style.letterSpacing}
                  onValueChange={value =>
                    updateLocalPage({
                      ...pageState,
                      texts: pageState.texts.map(item =>
                        item.id === currentText.id
                          ? {
                              ...item,
                              style: {...item.style, letterSpacing: value},
                            }
                          : item,
                      ),
                    })
                  }
                />
                <Text style={styles.meta}>行间距 {Math.round(currentText.style.lineHeight)}</Text>
                <Slider
                  minimumValue={12}
                  maximumValue={90}
                  step={1}
                  value={currentText.style.lineHeight}
                  onValueChange={value =>
                    updateLocalPage({
                      ...pageState,
                      texts: pageState.texts.map(item =>
                        item.id === currentText.id
                          ? {
                              ...item,
                              style: {...item.style, lineHeight: value},
                            }
                          : item,
                      ),
                    })
                  }
                />
                <View style={styles.row}>
                  <PrimaryButton
                    title="粗体"
                    onPress={() =>
                      updateLocalPage({
                        ...pageState,
                        texts: pageState.texts.map(item =>
                          item.id === currentText.id
                            ? {
                                ...item,
                                style: {
                                  ...item.style,
                                  fontWeight: item.style.fontWeight === 'bold' ? 'normal' : 'bold',
                                },
                              }
                            : item,
                        ),
                      })
                    }
                  />
                  <PrimaryButton
                    title="黑字"
                    onPress={() =>
                      updateLocalPage({
                        ...pageState,
                        texts: pageState.texts.map(item =>
                          item.id === currentText.id
                            ? {
                                ...item,
                                style: {
                                  ...item.style,
                                  color: item.style.color === '#000000' ? '#ffffff' : '#000000',
                                },
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </View>
              </>
            )}

            <View style={styles.row}>
              <PrimaryButton title="删除" onPress={() => {
                if (!editingTextId) {
                  return;
                }
                addHistory(pageState);
                updateLocalPage({...pageState, texts: pageState.texts.filter(item => item.id !== editingTextId)});
                setEditingTextId(null);
              }} />
              <PrimaryButton title="保存" onPress={saveText} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f4f4f4'},
  topBar: {
    padding: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {fontSize: 16, fontWeight: '700', color: '#111'},
  canvasWrap: {flex: 1, backgroundColor: '#ddd'},
  canvas: {flex: 1},
  toolbar: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    padding: 8,
    gap: 6,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap'},
  color: {width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#666'},
  colorActive: {borderWidth: 3, borderColor: '#2f66ff'},
  activeBtn: {backgroundColor: '#444'},
  meta: {fontSize: 12, color: '#555'},
  modalOverlay: {flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.22)'},
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 12,
    gap: 8,
    maxHeight: '82%',
  },
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#111'},
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    minHeight: 80,
    textAlignVertical: 'top',
    padding: 8,
  },
});
