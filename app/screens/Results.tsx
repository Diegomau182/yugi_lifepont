// Results.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Player {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  opponents: string[];
  matchResults: Record<string, 'win' | 'loss' | 'draw' | 'doubleLoss'>;
  gw?: number;
  omw?: number;
}

export default function Results() {
  const [players, setPlayers] = useState<Player[]>([]);
  const router = useRouter();

  useEffect(() => { loadResults(); }, []);

  const loadResults = async () => {
    const savedPlayers = await AsyncStorage.getItem('tournamentPlayers');
    if (!savedPlayers) return;

    const pl: Player[] = JSON.parse(savedPlayers);

    // Inicializamos valores
    pl.forEach(p => {
      p.points = p.points || 0;
      p.wins = p.wins || 0;
      p.losses = p.losses || 0;
      p.gamesWon = p.gamesWon || 0;
      p.gamesLost = p.gamesLost || 0;
      p.opponents = p.opponents || [];
      p.matchResults = p.matchResults || {};
    });

    // Calculamos GW%
    pl.forEach(p => {
      const totalGames = p.gamesWon + p.gamesLost;
      p.gw = totalGames === 0 ? 0 : Math.min(p.gamesWon / totalGames, 1);
    });

    // Calculamos OMW%
    pl.forEach(p => {
      if (p.opponents.length === 0) {
        p.omw = 0;
        return;
      }
      const opponents = p.opponents
        .map(id => pl.find(op => op.id === id))
        .filter(Boolean) as Player[];

      if (opponents.length === 0) {
        p.omw = 0;
        return;
      }

      const omwSum = opponents.reduce((acc, op) => {
        const totalGames = op.wins + op.losses;
        const winRate = totalGames > 0 ? op.wins / totalGames : 0;
        return acc + Math.min(winRate, 1);
      }, 0);

      p.omw = omwSum / opponents.length;
    });

    // Ordenamiento completo: Puntos → OMW% → GW% → Head-to-Head
    pl.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      const omwA = a.omw || 0;
      const omwB = b.omw || 0;
      if (omwB !== omwA) return omwB - omwA;

      const gwA = a.gw || 0;
      const gwB = b.gw || 0;
      if (gwB !== gwA) return gwB - gwA;

      if (a.opponents.includes(b.id)) {
        const result = a.matchResults[b.id];
        if (result === 'win') return -1;
        if (result === 'loss') return 1;
      }

      return 0;
    });

    // 🔹 Log detallado para debug completo
    console.log('=== Resultados finales ===');
    pl.forEach((p, i) => console.log(`${i+1}. ${p.name}`, JSON.stringify(p, null, 2)));

    setPlayers(pl);
  };

  const startNewTournament = () => {
    Alert.alert(
      'Otro Torneo',
      'Esto eliminará los datos del torneo actual. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí',
          onPress: async () => {
            await AsyncStorage.removeItem('tournamentRounds');
            await AsyncStorage.removeItem('currentRoundIndex');
            await AsyncStorage.removeItem('tournamentPlayers');
            await AsyncStorage.removeItem('tournamentActive');
            setPlayers([]);
            Alert.alert('¡Listo!', 'Puedes registrar nuevos jugadores.', [
              { text: 'OK', onPress: () => router.push('/screens/PlayerRegistration') }
            ]);
          }
        }
      ]
    );
  };

  const getMedal = (index: number) => index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

  // Detectar empate total en primeros lugares
  const firstPlaceTied = players.length > 1 && players[0].points === players[1].points &&
                         (players[0].gw || 0) === (players[1].gw || 0) &&
                         (players[0].omw || 0) === (players[1].omw || 0);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Resultados Finales</Text>

      {players.length > 0 && (
        <TouchableOpacity style={styles.newTournamentButton} onPress={startNewTournament}>
          <Ionicons name="trophy-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.newTournamentText}>Nuevo Torneo</Text>
        </TouchableOpacity>
      )}

      {players.length === 0 && <Text style={styles.noPlayers}>No hay resultados aún.</Text>}

      {firstPlaceTied && (
        <View style={{ marginBottom: 10, padding: 10, backgroundColor: '#333', borderRadius: 5 }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>⚠️ Empate total en los primeros lugares ⚠️</Text>
        </View>
      )}

      {players.length > 0 && (
        <>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerCell, { flex: 0.5 }]}>#</Text>
            <Text style={[styles.headerCell, { flex: 3 }]}>Nombre</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>Pts</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>GW%</Text>
            <Text style={[styles.headerCell, { flex: 1 }]}>OMW%</Text>
          </View>

          <FlatList
            data={players}
            keyExtractor={i => i.id}
            renderItem={({ item, index }) => (
              <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? '#1E1E1E' : '#2A2A2A' }]}>
                <Text style={[styles.cell, { flex: 0.5 }]}>{getMedal(index)} {index + 1}</Text>
                <Text style={[styles.cell, { flex: 3 }]}>{item.name}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{item.points}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{((item.gw || 0) * 100).toFixed(1)}</Text>
                <Text style={[styles.cell, { flex: 1 }]}>{((item.omw || 0) * 100).toFixed(1)}</Text>
              </View>
            )}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  newTournamentButton: { flexDirection: 'row', backgroundColor: '#FF6347', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, marginBottom: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 }, shadowRadius: 5, elevation: 5 },
  newTournamentText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#555', paddingVertical: 3, marginBottom: 5 },
  headerCell: { color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'center' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#333' },
  cell: { color: '#fff', fontSize: 12, textAlign: 'center' },
  noPlayers: { color: '#aaa', textAlign: 'center', marginBottom: 10 },
});
