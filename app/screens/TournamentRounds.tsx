import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Player {
  id: string;
  name: string;
  points: number;
  wins: number;
  losses: number;
  opponents: string[];
  gamesWon: number;
  gamesLost: number;
  OMW: number;
  GW: number;
  lastResult?: 'p1Win' | 'p2Win' | 'doubleLost';
}

interface Match {
  player1: Player;
  player2: Player;
  result?: 'p1Win' | 'p2Win' | 'doubleLost';
}

export default function TournamentRounds() {
  const [rounds, setRounds] = useState<Match[][]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);
  const [maxRounds, setMaxRounds] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadTournament().finally(() => setLoading(false));
  }, []);

  const determineMaxRounds = (numPlayers: number) => {
    if (numPlayers >= 4 && numPlayers <= 8) return 3;
    if (numPlayers >= 9 && numPlayers <= 16) return 4;
    if (numPlayers >= 17 && numPlayers <= 32) return 5;
    if (numPlayers >= 33 && numPlayers <= 64) return 6;
    if (numPlayers >= 65) return 7;
    Alert.alert('Error', 'El torneo requiere al menos 4 jugadores.');
    return 0;
  };

  const loadTournament = async () => {
    const savedPlayers = await AsyncStorage.getItem('tournamentPlayers');
    const savedRounds = await AsyncStorage.getItem('tournamentRounds');
    const savedIndex = await AsyncStorage.getItem('currentRoundIndex');

    if (!savedPlayers) {
      router.replace('/screens/PlayerRegistration');
      return;
    }

    const pl: Player[] = JSON.parse(savedPlayers).map((p: any) => ({
      id: p.id,
      name: p.name,
      points: p.points || 0,
      wins: p.wins || 0,
      losses: p.losses || 0,
      opponents: p.opponents || [],
      gamesWon: p.gamesWon || 0,
      gamesLost: p.gamesLost || 0,
      OMW: p.OMW || 0,
      GW: p.GW || 0,
      lastResult: p.lastResult,
    }));

    setPlayers(pl);
    setMaxRounds(determineMaxRounds(pl.length));

    if (savedRounds && savedIndex != null) {
      setRounds(JSON.parse(savedRounds));
      setCurrentRoundIndex(Number(savedIndex));
    } else {
      const firstRound = generateSwissRound(pl);
      setRounds([firstRound]);
      setCurrentRoundIndex(0);
      await saveTournament([firstRound], 0, pl);
    }
  };

  const saveTournament = async (updatedRounds: Match[][], updatedIndex: number, updatedPlayers?: Player[]) => {
    await AsyncStorage.setItem('tournamentRounds', JSON.stringify(updatedRounds));
    await AsyncStorage.setItem('currentRoundIndex', updatedIndex.toString());
    await AsyncStorage.setItem('tournamentPlayers', JSON.stringify(updatedPlayers || players));
  };

  const calculateOMW = (player: Player, allPlayers: Record<string, Player>) => {
    if (!player.opponents.length) return 0;

    let totalOMW = 0;
    let count = 0;

    player.opponents.forEach(oppId => {
      const opp = allPlayers[oppId];
      if (opp) {
        const matchesPlayed = opp.wins + opp.losses;
        const maxPoints = matchesPlayed * 3;
        totalOMW += maxPoints > 0 ? opp.points / maxPoints : 0;
        count++;
      }
    });

    return count > 0 ? totalOMW / count : 0;
  };

  const calculateGW = (player: Player) => {
    const totalGames = player.gamesWon + player.gamesLost;
    return totalGames ? player.gamesWon / totalGames : 0;
  };

  const applyMatchResult = (p1: Player, p2: Player, result?: 'p1Win' | 'p2Win' | 'doubleLost') => {
    p1.lastResult = undefined;
    p2.lastResult = undefined;

    if (!result) return;

    switch (result) {
      case 'p1Win':
        p1.points += 3; p1.wins += 1; p1.gamesWon += 1;
        p2.losses += 1; p2.gamesLost += 1;
        break;
      case 'p2Win':
        p2.points += 3; p2.wins += 1; p2.gamesWon += 1;
        p1.losses += 1; p1.gamesLost += 1;
        break;
      case 'doubleLost':
        p1.losses += 1;
        p2.losses += 1;
        break;
    }

    p1.lastResult = result;
    p2.lastResult = result;
  };

  // ✅ SOLO ESTA FUNCIÓN CAMBIÓ (SWISS SIN REPETIR ADVERSARIOS)
  const generateSwissRound = (playersList: Player[]): Match[] => {
    const sortedPlayers = [...playersList].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.OMW !== a.OMW) return b.OMW - a.OMW;
      return b.GW - a.GW;
    });

    const matches: Match[] = [];
    const used = new Set<string>();

    for (let i = 0; i < sortedPlayers.length; i++) {
      const p1 = sortedPlayers[i];
      if (used.has(p1.id)) continue;

      let candidates = sortedPlayers.filter(
        p =>
          p.id !== p1.id &&
          !used.has(p.id) &&
          !p1.opponents.includes(p.id)
      );

      candidates.sort(
        (a, b) =>
          Math.abs(a.points - p1.points) - Math.abs(b.points - p1.points)
      );

      if (!candidates.length) {
        candidates = sortedPlayers.filter(
          p => p.id !== p1.id && !used.has(p.id)
        );
      }

      if (!candidates.length) continue;

      const p2 = candidates[0];

      matches.push({ player1: p1, player2: p2 });
      used.add(p1.id);
      used.add(p2.id);

      if (!p1.opponents.includes(p2.id)) p1.opponents.push(p2.id);
      if (!p2.opponents.includes(p1.id)) p2.opponents.push(p1.id);
    }

    return matches;
  };

  const recalculateRoundsFrom = () => {
    const allPlayers: Record<string, Player> = {};
    players.forEach(p => {
      allPlayers[p.id] = {
        ...p,
        points: 0,
        wins: 0,
        losses: 0,
        opponents: [],
        gamesWon: 0,
        gamesLost: 0,
        OMW: 0,
        GW: 0,
        lastResult: undefined,
      };
    });

    const newRounds: Match[][] = [];

    for (let r = 0; r < rounds.length; r++) {
      const round = rounds[r].map(match => {
        const p1 = allPlayers[match.player1.id];
        const p2 = allPlayers[match.player2.id];

        if (!p1.opponents.includes(p2.id)) p1.opponents.push(p2.id);
        if (!p2.opponents.includes(p1.id)) p2.opponents.push(p1.id);

        applyMatchResult(p1, p2, match.result);

        return { player1: p1, player2: p2, result: match.result };
      });

      newRounds.push(round);
    }

    Object.values(allPlayers).forEach(p => {
      p.OMW = calculateOMW(p, allPlayers);
      p.GW = calculateGW(p);
    });

    setPlayers(Object.values(allPlayers).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.OMW !== a.OMW) return b.OMW - a.OMW;
      return b.GW - a.GW;
    }));

    setRounds(newRounds);
  };

  const setMatchResult = (roundIndex: number, matchIndex: number, result: 'p1Win' | 'p2Win' | 'doubleLost') => {
    rounds[roundIndex][matchIndex].result = result;
    recalculateRoundsFrom();
  };

  const allResultsSet = () => rounds[currentRoundIndex]?.every(m => m.result);

  const nextRound = async () => {
    if (!allResultsSet()) return Alert.alert('Error', 'Todos los duelos deben tener resultado antes de avanzar.');

    const nextRoundMatches = generateSwissRound(players);
    if (!nextRoundMatches.length) {
      Alert.alert('Torneo Finalizado', 'No hay más emparejamientos posibles.');
      router.replace('/screens/Results');
      return;
    }

    const newRounds = [...rounds, nextRoundMatches];
    setRounds(newRounds);
    setCurrentRoundIndex(currentRoundIndex + 1);
    await saveTournament(newRounds, currentRoundIndex + 1, players);

    if (currentRoundIndex + 1 >= maxRounds) {
      Alert.alert('Torneo Finalizado');
      router.replace('/screens/Results');
    }
  };

  const previousRound = () => {
    if (currentRoundIndex > 0) setCurrentRoundIndex(currentRoundIndex - 1);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1E90FF" />
        <Text style={styles.title}>Cargando torneo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rounds[currentRoundIndex]}
        keyExtractor={(_, i) => i.toString()}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Ronda {currentRoundIndex + 1}</Text>
            {currentRoundIndex > 0 && (
              <TouchableOpacity style={styles.backButton} onPress={previousRound}>
                <Text style={styles.backText}>← Regresar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.diceButton} onPress={nextRound}>
              <Ionicons name="dice-outline" size={32} color="#1E90FF" />
            </TouchableOpacity>
          </>
        }
        renderItem={({ item, index }) => {
          const p1Win = item.result === 'p1Win';
          const p2Win = item.result === 'p2Win';
          const doubleLost = item.result === 'doubleLost';

          return (
            <View style={styles.matchBox}>
              <Text style={[styles.matchText, p1Win ? styles.winner : doubleLost ? styles.loser : {}]}>
                {item.player1.name} {p1Win ? '(GANADOR)' : doubleLost ? '(PERDIÓ)' : ''}
              </Text>
              <Text style={[styles.matchText, p2Win ? styles.winner : doubleLost ? styles.loser : {}]}>
                {item.player2.name} {p2Win ? '(GANADOR)' : doubleLost ? '(PERDIÓ)' : ''}
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.resultButton, p1Win && styles.buttonWin]}
                  onPress={() => setMatchResult(currentRoundIndex, index, 'p1Win')}
                >
                  <Text style={styles.buttonText}>WIN P1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.resultButton, p2Win && styles.buttonWin]}
                  onPress={() => setMatchResult(currentRoundIndex, index, 'p2Win')}
                >
                  <Text style={styles.buttonText}>WIN P2</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.resultButton, doubleLost && styles.buttonLost]}
                  onPress={() => setMatchResult(currentRoundIndex, index, 'doubleLost')}
                >
                  <Text style={styles.buttonText}>DOUBLE LOST</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center' },
  matchBox: { padding: 10, marginBottom: 10, borderRadius: 5, backgroundColor: '#1E1E1E' },
  matchText: { fontSize: 18, color: '#fff', marginBottom: 10 },
  percentageText: { fontSize: 14, color: '#aaa', marginBottom: 5 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around' },
  resultButton: { backgroundColor: '#333', padding: 10, borderRadius: 5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  winner: { color: '#32CD32', fontWeight: 'bold' },
  loser: { opacity: 0.5, color: '#ff4d4d' },
  buttonWin: { backgroundColor: '#32CD32' },
  buttonLost: { backgroundColor: '#FF4500' },
  diceButton: { alignSelf: 'center', marginBottom: 20, padding: 10, backgroundColor: '#1E1E1E', borderRadius: 8 },
  backButton: { alignSelf: 'center', marginBottom: 10, padding: 10, backgroundColor: '#333', borderRadius: 5 },
  backText: { color: '#fff', fontWeight: 'bold' },
});
