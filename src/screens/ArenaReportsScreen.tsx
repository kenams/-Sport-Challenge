// src/screens/ArenaReportsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import ScreenContainer from "../components/ScreenContainer";
import { supabase } from "../supabase";
import { COLORS } from "../theme";
import AppButton from "../components/AppButton";

type Report = {
  id: number;
  offender_id: string;
  reporter_id: string;
  reason?: string;
  created_at: string;
  status?: string;
};

export default function ArenaReportsScreen() {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("arena_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setReports(data as Report[]);
    } else {
      setReports([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleReportAction = async (
    report: Report,
    action: "validated" | "rejected"
  ) => {
    if (actionLoading !== null) return;
    try {
      setActionLoading(report.id);
      const { error } = await supabase
        .from("arena_reports")
        .update({ status: action })
        .eq("id", report.id);
      if (error) throw error;

      if (action === "validated") {
        await supabase.from("punishments").insert({
          user_id: report.offender_id,
          ads_remaining: 3,
          active: true,
        });
      }

      Alert.alert(
        "Rapport traité",
        action === "validated"
          ? "Sanction appliquée (3 pubs)."
          : "Signalement rejeté."
      );
      fetchReports();
    } catch (err: any) {
      console.log("REPORT ACTION ERROR", err);
      Alert.alert("Impossible de traiter ce rapport.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            color: COLORS.text,
            marginBottom: 8,
          }}
        >
          Moderation Arena
        </Text>
        <Text style={{ color: COLORS.textMuted, marginBottom: 16 }}>
          Rapports récents (limités à 50). Pour chaque cas, valide ou rejette la
          sanction dans Supabase.
        </Text>
        <AppButton
          label="Actualiser"
          onPress={fetchReports}
          variant="ghost"
          style={{ marginBottom: 16 }}
        />
        {reports.length === 0 ? (
          <Text style={{ color: COLORS.textMuted }}>
            Aucun report enregistré.
          </Text>
        ) : (
          reports.map((report) => (
            <View
              key={report.id}
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 16,
                padding: 14,
                marginBottom: 14,
                backgroundColor: COLORS.surface,
              }}
            >
              <Text
                style={{
                  fontWeight: "800",
                  color: COLORS.text,
                  marginBottom: 4,
                }}
              >
                Report #{report.id} • {report.status || "pending"}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                {new Date(report.created_at).toLocaleString("fr-FR")}
              </Text>
              <Text style={{ color: COLORS.text, marginTop: 8, fontSize: 12 }}>
                Reporter : {report.reporter_id}
              </Text>
              <Text style={{ color: COLORS.text, fontSize: 12 }}>
                Offenseur : {report.offender_id}
              </Text>
              {report.reason && (
                <Text style={{ color: COLORS.textMuted, marginTop: 6 }}>
                  {report.reason}
                </Text>
              )}
              {report.status === "pending" && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <AppButton
                    label="Valider"
                    size="sm"
                    onPress={() => handleReportAction(report, "validated")}
                    loading={actionLoading === report.id}
                  />
                  <AppButton
                    label="Rejeter"
                    size="sm"
                    variant="ghost"
                    onPress={() => handleReportAction(report, "rejected")}
                    loading={actionLoading === report.id}
                  />
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
