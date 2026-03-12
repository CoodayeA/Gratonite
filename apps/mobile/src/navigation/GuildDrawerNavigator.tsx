import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, RefreshControl, ActivityIndicator } from 'react-native';
import { createDrawerNavigator, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../lib/api';
import { useTheme, useColors } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { selectionFeedback } from '../lib/haptics';
import type { Channel } from '../types';
import ChannelChatScreen from '../screens/guild/ChannelChatScreen';
import VoiceChannelScreen from '../screens/guild/VoiceChannelScreen';

const Drawer = createDrawerNavigator();

interface Section {
    title: string;
    data: Channel[];
}

function CustomDrawerContent(props: DrawerContentComponentProps & { guildId: string; guildName: string }) {
    const insets = useSafeAreaInsets();
    const { colors, spacing, fontSize } = useTheme();
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
                result.push({ title: (cat.name || 'Untitled').toUpperCase(), data: children });
            }
        });

        return result;
    }, [channelList]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'GUILD_TEXT': return 'chatbubble-outline';
            case 'GUILD_VOICE': return 'volume-medium-outline';
            case 'GUILD_ANNOUNCEMENT': return 'megaphone-outline';
            case 'GUILD_FORUM': return 'reader-outline';
            case 'GUILD_WIKI': return 'book-outline';
            case 'GUILD_TIMELINE': return 'time-outline';
            case 'GUILD_QA': return 'help-circle-outline';
            case 'GUILD_STAGE': return 'mic-outline';
            default: return 'chatbubble-outline';
        }
    };

    const drawerStyles = useMemo(() => StyleSheet.create({
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
        backBtn: {
            padding: spacing.xs,
            marginRight: spacing.sm,
        },
    }), [colors, spacing, fontSize]);

    return (
        <View style={drawerStyles.drawerContainer}>
            <View style={[drawerStyles.drawerHeader, { paddingTop: insets.top + spacing.md }]}>
                <TouchableOpacity onPress={() => (props.navigation as any).getParent()?.goBack()} style={drawerStyles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={drawerStyles.drawerTitle} numberOfLines={1}>{props.guildName}</Text>
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
                    <Text style={drawerStyles.sectionTitle}>{section.title}</Text>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={drawerStyles.channelItem}
                        onPress={() => {
                            if (item.type === 'GUILD_VOICE') {
                                props.navigation.navigate('VoiceChannel', { channelId: item.id, channelName: item.name, guildId: props.guildId });
                            } else if (item.type === 'GUILD_FORUM') {
                                props.navigation.navigate('ForumChannel', { channelId: item.id, channelName: item.name });
                            } else if (item.type === 'GUILD_WIKI') {
                                props.navigation.navigate('WikiChannel', { channelId: item.id, channelName: item.name });
                            } else if (item.type === 'GUILD_ANNOUNCEMENT') {
                                props.navigation.navigate('AnnouncementChannel', { channelId: item.id, channelName: item.name, guildId: props.guildId });
                            } else if (item.type === 'GUILD_TIMELINE') {
                                props.navigation.navigate('TimelineChannel', { channelId: item.id, channelName: item.name });
                            } else if (item.type === 'GUILD_QA') {
                                props.navigation.navigate('QAChannel', { channelId: item.id, channelName: item.name });
                            } else if (item.type === 'GUILD_STAGE') {
                                props.navigation.navigate('StageChannel', { channelId: item.id, channelName: item.name, guildId: props.guildId });
                            } else {
                                props.navigation.navigate('ChannelChat', { channelId: item.id, channelName: item.name, guildId: props.guildId });
                            }
                        }}
                    >
                        <Ionicons name={getIcon(item.type) as any} size={20} color={colors.textMuted} />
                        <Text style={drawerStyles.channelName} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

function GuildLandingScreen({ navigation, guildId }: { navigation: any; guildId: string }) {
    const colors = useColors();
    const [error, setError] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const channels = await channelsApi.getForGuild(guildId);
                const textChannel = channels.find((c) => c.type === 'GUILD_TEXT' || c.type === 'GUILD_ANNOUNCEMENT');
                if (mounted && textChannel) {
                    navigation.navigate('ChannelChat', { channelId: textChannel.id, channelName: textChannel.name, guildId });
                } else if (mounted) {
                    setError(true);
                }
            } catch {
                if (mounted) setError(true);
            }
        })();
        return () => { mounted = false; };
    }, [guildId, navigation]);

    if (error) {
        return (
            <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>
                    No channels available
                </Text>
                <TouchableOpacity
                    style={{ marginTop: 20, backgroundColor: colors.accentPrimary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
                    onPress={() => navigation.openDrawer()}
                >
                    <Text style={{ color: colors.white, fontWeight: '600' }}>Open Menu</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
    );
}

export default function GuildDrawerNavigator({ route }: any) {
    const { guildId, guildName } = route.params;
    const { colors, spacing } = useTheme();

    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} guildId={guildId} guildName={guildName} />}
            screenOptions={({ navigation: nav }) => ({
                headerStyle: { backgroundColor: colors.bgSecondary },
                headerTintColor: colors.textPrimary,
                drawerStyle: { backgroundColor: colors.bgSecondary, width: 280 },
                sceneStyle: { backgroundColor: colors.bgPrimary },
                swipeEnabled: true,
                swipeEdgeWidth: 50,
                drawerType: 'slide' as const,
                headerRight: () => (
                    <TouchableOpacity onPress={() => (nav as any).getParent()?.navigate('MainTabs')} style={{ padding: spacing.sm }}>
                        <Ionicons name="home-outline" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                ),
            })}
            screenListeners={{
                drawerItemPress: () => selectionFeedback(),
            }}
        >
            <Drawer.Screen
                name="SelectChannel"
                options={{ title: guildName }}
            >
                {({ navigation: screenNav }) => (
                    <GuildLandingScreen navigation={screenNav} guildId={guildId} />
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

