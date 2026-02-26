import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string } }, 'params'>;

interface AutoModRule {
  id: string;
  name: string;
  type: 'spam' | 'links' | 'words' | 'mentions' | 'caps';
  enabled: boolean;
  action: 'warn' | 'kick' | 'ban' | 'delete';
  config?: Record<string, any>;
}

export function AutoModScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId } = route.params;
  const [rules, setRules] = useState<AutoModRule[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchRules() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/automod`, { credentials: 'include' });
        const data = await res.json();
        setRules(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchRules();
  }, [guildId]);

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/v1/guilds/${guildId}/automod/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
        credentials: 'include',
      });
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'warn': return colors.accent.warning;
      case 'kick': return colors.brand.primary;
      case 'ban': return colors.accent.error;
      case 'delete': return colors.accent.success;
      default: return colors.text.muted;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'spam': return '🚫';
      case 'links': return '🔗';
      case 'words': return '📝';
      case 'mentions': return '@';
      case 'caps': return '🔠';
      default: return '⚙️';
    }
  };

  const renderRule = ({ item }: { item: AutoModRule }) => (
    <View style={styles.ruleCard}>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleInfo}>
          <Text style={styles.ruleIcon}>{getTypeIcon(item.type)}</Text>
          <View>
            <Text style={styles.ruleName}>{item.name}</Text>
            <Text style={styles.ruleType}>{item.type}</Text>
          </View>
        </View>
        <Switch
          value={item.enabled}
          onValueChange={(val) => toggleRule(item.id, val)}
          trackColor={{ false: colors.bg.secondary, true: colors.brand.primary + '60' }}
          thumbColor={item.enabled ? colors.brand.primary : colors.text.muted}
        />
      </View>
      <View style={styles.ruleFooter}>
        <Text style={styles.actionLabel}>Action:</Text>
        <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) + '20' }]}>
          <Text style={[styles.actionText, { color: getActionColor(item.action) }]}>{item.action.toUpperCase()}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AutoMod</Text>
      </View>
      <FlatList
        data={rules}
        renderItem={renderRule}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No AutoMod rules configured</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  list: { padding: spacing.md },
  ruleCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  ruleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ruleInfo: { flexDirection: 'row', alignItems: 'center' },
  ruleIcon: { fontSize: 24, marginRight: spacing.md },
  ruleName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text.primary },
  ruleType: { fontSize: fontSize.xs, color: colors.text.muted, textTransform: 'capitalize' },
  ruleFooter: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.stroke.primary },
  actionLabel: { fontSize: fontSize.sm, color: colors.text.muted, marginRight: spacing.sm },
  actionBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  actionText: { fontSize: fontSize.xs, fontWeight: '600' },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
