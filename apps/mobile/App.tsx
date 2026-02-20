import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.background}>
        <View style={[styles.glow, styles.glowTop]} />
        <View style={[styles.glow, styles.glowMid]} />
        <View style={[styles.glow, styles.glowBottom]} />
      </View>

      <View style={styles.shell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Gratonite</Text>
            <Text style={styles.subtitle}>Mobile preview • Phase 7</Text>
          </View>
          <TouchableOpacity style={styles.pill}>
            <Text style={styles.pillText}>Live</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Spaces</Text>
            <Text style={styles.cardCopy}>Jump into active rooms instantly.</Text>
            <View style={styles.listItem}>
              <View style={styles.avatar} />
              <View>
                <Text style={styles.listTitle}>Arclight Guild</Text>
                <Text style={styles.listMeta}>7 new messages • #lab</Text>
              </View>
            </View>
            <View style={styles.listItem}>
              <View style={styles.avatarAlt} />
              <View>
                <Text style={styles.listTitle}>Flux Studio</Text>
                <Text style={styles.listMeta}>Voice active • #render</Text>
              </View>
            </View>
          </View>

          <View style={styles.cardPrimary}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.cardTitle}>#general</Text>
                <Text style={styles.cardCopy}>142 online • design review</Text>
              </View>
              <View style={styles.statusDot} />
            </View>
            <View style={styles.message}>
              <View style={styles.avatarSmall} />
              <View>
                <Text style={styles.listTitle}>Avery</Text>
                <Text style={styles.listMeta}>Voice stack is live for mobile.</Text>
              </View>
            </View>
            <View style={styles.message}>
              <View style={styles.avatarSmallAlt} />
              <View>
                <Text style={styles.listTitle}>Leona</Text>
                <Text style={styles.listMeta}>New gradient maps shipped.</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Now Playing</Text>
            <Text style={styles.cardCopy}>Voice + events overview.</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Status</Text>
              <Text style={styles.statValue}>Ready</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Next Event</Text>
              <Text style={styles.statValue}>Design review • 4:00 PM</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.composer}>
          <TextInput placeholder="Message #general" placeholderTextColor="#7f93aa" style={styles.input} />
          <TouchableOpacity style={styles.send}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabbar}>
          {['Home', 'DMs', 'Spaces', 'Voice', 'You'].map((label) => (
            <TouchableOpacity key={label} style={styles.tabItem}>
              <Text style={styles.tabText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0f1a',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.24,
  },
  glowTop: {
    backgroundColor: '#5fd7ff',
    top: -80,
    left: -40,
  },
  glowMid: {
    backgroundColor: '#ffcf6a',
    top: 120,
    right: -90,
  },
  glowBottom: {
    backgroundColor: '#9bffdf',
    bottom: -110,
    left: 40,
  },
  shell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    color: '#f1f6ff',
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: 'Avenir Next',
  },
  subtitle: {
    fontSize: 12,
    color: '#9fb1c7',
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderColor: 'rgba(95, 215, 255, 0.35)',
    borderWidth: 1,
    backgroundColor: 'rgba(95, 215, 255, 0.12)',
  },
  pillText: {
    color: '#dff6ff',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    paddingBottom: 120,
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(17, 26, 43, 0.9)',
    borderRadius: 20,
    borderColor: 'rgba(140, 178, 220, 0.15)',
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardPrimary: {
    backgroundColor: 'rgba(20, 31, 51, 0.85)',
    borderRadius: 20,
    borderColor: 'rgba(95, 215, 255, 0.2)',
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    fontSize: 18,
    color: '#f1f6ff',
    fontWeight: '600',
    fontFamily: 'Avenir Next',
  },
  cardCopy: {
    fontSize: 12,
    color: '#9fb1c7',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  listTitle: {
    color: '#f1f6ff',
    fontSize: 14,
    fontWeight: '600',
  },
  listMeta: {
    color: '#9fb1c7',
    fontSize: 12,
    marginTop: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(95, 215, 255, 0.25)',
    borderColor: 'rgba(95, 215, 255, 0.4)',
    borderWidth: 1,
  },
  avatarAlt: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 207, 106, 0.2)',
    borderColor: 'rgba(255, 207, 106, 0.4)',
    borderWidth: 1,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(95, 215, 255, 0.25)',
  },
  avatarSmallAlt: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(155, 255, 223, 0.2)',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5fd7ff',
    shadowColor: '#5fd7ff',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  message: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statLabel: {
    color: '#9fb1c7',
    fontSize: 12,
  },
  statValue: {
    color: '#f1f6ff',
    fontSize: 12,
    fontWeight: '600',
  },
  composer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(9, 14, 24, 0.9)',
    borderColor: 'rgba(95, 215, 255, 0.2)',
    borderWidth: 1,
  },
  input: {
    flex: 1,
    color: '#f1f6ff',
    fontSize: 13,
  },
  send: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(95, 215, 255, 0.2)',
    borderColor: 'rgba(95, 215, 255, 0.4)',
    borderWidth: 1,
  },
  sendText: {
    color: '#e7f9ff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabbar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 24, 38, 0.9)',
    borderColor: 'rgba(140, 178, 220, 0.15)',
    borderWidth: 1,
  },
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  tabText: {
    color: '#9fb1c7',
    fontSize: 11,
  },
});
