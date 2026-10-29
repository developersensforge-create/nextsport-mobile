import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import { getInvitePreview, acceptInvite } from '../lib/api';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type InviteAcceptRouteProp = RouteProp<RootStackParamList, 'InviteAccept'>;
type InviteAcceptNavProp = StackNavigationProp<RootStackParamList>;

export default function InviteAcceptScreen() {
  const route = useRoute<InviteAcceptRouteProp>();
  const navigation = useNavigation<InviteAcceptNavProp>();
  const { session } = useAuth();
  const { code } = route.params;

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      // Not logged in — navigate to Auth
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      return;
    }

    async function loadPreview() {
      try {
        const data = await getInvitePreview(code);
        setCoachName(data.coach_name);
      } catch {
        setError('此邀请已过期或不存在');
      } finally {
        setLoading(false);
      }
    }

    loadPreview();
  }, [code, session]);

  async function handleAccept() {
    setAccepting(true);
    try {
      await acceptInvite(code);
      Alert.alert('绑定成功！', `你已成功加入 ${coachName ?? 'Coach'} 的训练计划。`, [
        {
          text: '好的',
          onPress: () => navigation.navigate('MainTabs'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('绑定失败', err?.response?.data?.error ?? err?.message ?? '请稍后再试');
    } finally {
      setAccepting(false);
    }
  }

  function handleDecline() {
    navigation.goBack();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.danger} style={{ marginBottom: 16 }} />
          <Text style={styles.errorTitle}>邀请无效</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
            <Text style={styles.btnBackText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="person-add" size={40} color={COLORS.accent} />
        </View>

        {/* Title */}
        <Text style={styles.title}>教练邀请</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.coachName}>{coachName ?? 'Coach'}</Text>
          {' 邀请你加入训练计划'}
        </Text>

        <Text style={styles.desc}>
          接受邀请后，你的训练数据和进度将与教练共享。教练可以为你布置训练作业并跟踪你的进步。
        </Text>

        {/* Invite code display */}
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>邀请码</Text>
          <Text style={styles.codeText}>{code}</Text>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.btnAccept, accepting && styles.btnDisabled]}
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={accepting}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.btnAcceptText}>接受邀请</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnDecline} onPress={handleDecline} activeOpacity={0.7}>
          <Text style={styles.btnDeclineText}>拒绝</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  coachName: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  desc: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  codeBox: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  codeLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  codeText: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  btnAccept: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnAcceptText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  btnDecline: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  btnDeclineText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
  },
  btnBack: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
  },
  btnBackText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
