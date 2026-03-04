import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, RefreshControl } from 'react-native';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../lib/api';
import { colors, spacing, fontSize } from '../lib/theme';
import type { Channel } from '../types';
import ChannelChatScreen from '../screens/guild/ChannelChatScreen';
import VoiceChannelScreen from '../screens/guild/VoiceChannelScreen';

const Drawer = createDrawerNavigator();

interface Section {
    title: string;
    data: Channel[];
}

function CustomDrawerContent(props: DrawerContentComponentProps & { guildId: string; guildName: string }) {
    const [channelList, setChannelList] = useState<Channel[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchChannels = useCallback(async () => {
        try {
            const data = await channelsApi.getForGuild(props.guildId);
            setChannelList(data);
        } catch {
            // ignore
        } finally {
            setRefreshing(false);
        }
    }, [props.guildId]);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    const sections: Section[] = useMemo(() => {
        const categories = channelList.filter((c) => c.type === 'GUILD_CATEGORY');
        const uncategorized = channelList.filter((c) => c.type !== 'GUILD_CATEGORY' && !c.parentId);

        const result: Section[] = [];
        if (uncategorized.length > 0) result.push({ title: 'CHANNELS', data: uncategorized });

        categories.forEach((cat) => {
            const children = channelList
                .filter((c) => c.parentId === cat.id)
                .sort((a, b) => a.position - b.position);
            if (children.length > 0) {
                result.push({ title: cat.name.toUpperCase(), data: children });
            }
        });

        return result;
    }, [channelList]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'GUILD_TEXT': return 'chatbubble-outline';
            case 'GUILD_VOICE': return 'volume-medium-outline';
            case 'GUILD_ANNOUNCEMENT': return 'megaphone-outline';
            default: return 'chatbubble-outline';
        }
    };

    return (
        <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle} numberOfLines={1}>{props.guildName}</Text>
                <TouchableOpacity onPress={() => (props.navigation as any).navigate('GuildSettings', { guildId: props.guildId, guildName: props.guildName })}>
                    <Ionicons name="settings-outline" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
            </View>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchChannels(); }} tintColor={colors.accentPrimary} />}
                renderSectionHeader={({ section }) => (
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.channelItem}
                        onPress={() => {
                            if (item.type === 'GUILD_VOICE') {
                                props.navigation.navigate('VoiceChannel', { channelId: item.id, channelName: item.name, guildId: props.guildId });
                            } else {
                                props.navigation.navigate('ChannelChat', { channelId: item.id, channelName: item.name, guildId: props.guildId });
                            }
                        }}
                    >
                        <Ionicons name={getIcon(item.type) as any} size={20} color={colors.textMuted} />
                        <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

export default function GuildDrawerNavigator({ route }: any) {
    const { guildId, guildName } = route.params;

    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} guildId={guildId} guildName={guildName} />}
            screenOptions={{
                headerStyle: { backgroundColor: colors.bgSecondary },
                headerTintColor: colors.textPrimary,
                drawerStyle: { backgroundColor: colors.bgSecondary, width: 280 },
                sceneStyle: { backgroundColor: colors.bgPrimary },
            }}
        >
            <Drawer.Screen
                name="SelectChannel"
                options={{ title: guildName }}
            >
                {({ navigation }) => (
                    <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="arrow-forward" size={48} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, marginTop: spacing.md, fontSize: fontSize.md }}>
                            Open the menu to select a channel
                        </Text>
                        <TouchableOpacity
                            style={{ marginTop: spacing.xl, backgroundColor: colors.accentPrimary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
                            onPress={() => navigation.openDrawer()}
                        >
                            <Text style={{ color: colors.white, fontWeight: '600' }}>Open Menu</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </Drawer.Screen>
            <Drawer.Screen
                name="ChannelChat"
                component={ChannelChatScreen}
                options={({ route }: any) => ({ title: `#${route.params?.channelName || 'channel'}` })}
            />
            <Drawer.Screen
                name="VoiceChannel"
                component={VoiceChannelScreen}
                options={({ route }: any) => ({ title: route.params?.channelName || 'Voice' })}
            />
        </Drawer.Navigator>
    );
}

const styles = StyleSheet.create({
    drawerContainer: {
        flex: 1,
        backgroundColor: colors.bgSecondary,
    },
    drawerHeader: {
        paddingTop: 50,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.bgElevated,
    },
    drawerTitle: {
        color: colors.textPrimary,
        fontSize: fontSize.lg,
        fontWeight: '700',
        flex: 1,
        marginRight: spacing.sm,
    },
    sectionTitle: {
        color: colors.textMuted,
        fontSize: fontSize.xs,
        fontWeight: '700',
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.lg,
        letterSpacing: 1,
    },
    channelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
    },
    channelName: {
        color: colors.textSecondary,
        fontSize: fontSize.md,
        fontWeight: '500',
        flex: 1,
    },
});
