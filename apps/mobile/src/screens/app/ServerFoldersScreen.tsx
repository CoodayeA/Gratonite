import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { serverFolders as foldersApi, guilds as guildsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { ServerFolder, Guild } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ServerFolders'>;

export default function ServerFoldersScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [folders, setFolders] = useState<ServerFolder[]>([]);
  const [myGuilds, setMyGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create / edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ServerFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [selectedGuildIds, setSelectedGuildIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [foldersData, guildsData] = await Promise.all([
        foldersApi.list(),
        guildsApi.getMine(),
      ]);
      setFolders(foldersData);
      setMyGuilds(guildsData);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load folders');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const openCreateModal = () => {
    setEditingFolder(null);
    setFolderName('');
    setSelectedGuildIds(new Set());
    setShowModal(true);
  };

  const openEditModal = (folder: ServerFolder) => {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setSelectedGuildIds(new Set(folder.guildIds));
    setShowModal(true);
  };

  const toggleGuild = (guildId: string) => {
    setSelectedGuildIds((prev) => {
      const next = new Set(prev);
      if (next.has(guildId)) {
        next.delete(guildId);
      } else {
        next.add(guildId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const name = folderName.trim();
    if (!name) return;

    setSaving(true);
    try {
      const guildIds = Array.from(selectedGuildIds);
      if (editingFolder) {
        await foldersApi.update(editingFolder.id, { name, guildIds });
      } else {
        await foldersApi.create({ name, guildIds });
      }
      setShowModal(false);
      fetchData();
    } catch {
      toast.error('Failed to save folder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (folder: ServerFolder) => {
    Alert.alert('Delete Folder', `Delete "${folder.name}"? Servers inside will not be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await foldersApi.delete(folder.id);
            setFolders((prev) => prev.filter((f) => f.id !== folder.id));
          } catch {
            toast.error('Failed to delete folder');
          }
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingVertical: spacing.sm,
    },
    folderItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    folderIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    folderInfo: {
      flex: 1,
    },
    folderName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    folderMeta: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    deleteBtn: {
      padding: spacing.sm,
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: 30,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    sheetBody: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    fieldInput: {
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    guildSelectList: {
      maxHeight: 250,
      marginBottom: spacing.lg,
    },
    guildSelectItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    guildSelectItemActive: {
      borderWidth: 1,
      borderColor: colors.accentPrimary,
    },
    guildSelectIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.bgHover,
      justifyContent: 'center',
      alignItems: 'center',
    },
    guildSelectIconText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    guildSelectName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      flex: 1,
    },
    saveButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginBottom: spacing.lg,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderFolder = ({ item }: { item: ServerFolder }) => (
    <TouchableOpacity style={styles.folderItem} onPress={() => openEditModal(item)}>
      <View style={[styles.folderIcon, item.color ? { backgroundColor: item.color } : null]}>
        <Ionicons name="folder" size={22} color={colors.white} />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.folderMeta}>
          {item.guildIds.length} {item.guildIds.length === 1 ? 'server' : 'servers'}
        </Text>
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={folders}
        keyExtractor={(item) => item.id}
        renderItem={renderFolder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-outline"
            title="No folders"
            subtitle="Organize your servers into folders"
            actionLabel="Create Folder"
            onAction={openCreateModal}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {editingFolder ? 'Edit Folder' : 'Create Folder'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <Text style={styles.fieldLabel}>Folder Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={folderName}
                onChangeText={setFolderName}
                placeholder="My Folder"
                placeholderTextColor={colors.textMuted}
                maxLength={50}
              />

              <Text style={styles.fieldLabel}>Select Servers</Text>
              <FlatList
                data={myGuilds}
                keyExtractor={(item) => item.id}
                style={styles.guildSelectList}
                renderItem={({ item }) => {
                  const selected = selectedGuildIds.has(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.guildSelectItem, selected && styles.guildSelectItemActive]}
                      onPress={() => toggleGuild(item.id)}
                    >
                      <View style={styles.guildSelectIcon}>
                        <Text style={styles.guildSelectIconText}>
                          {item.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.guildSelectName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selected ? colors.accentPrimary : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity
                style={[styles.saveButton, (!folderName.trim() || saving) && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={!folderName.trim() || saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : editingFolder ? 'Save Changes' : 'Create Folder'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
