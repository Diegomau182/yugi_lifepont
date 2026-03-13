import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons'; // flechas
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5'; // gato

interface Player {
  id: string;
  name: string;
}

export default function PlayerRegistration() {
  const [newPlayer, setNewPlayer] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [tournamentPlayers, setTournamentPlayers] = useState<Player[]>([]);
  const router = useRouter();

  useEffect(() => {
    initPlayers();
  }, []);

  const initPlayers = async () => {
    const savedPlayers = await AsyncStorage.getItem('tournamentPlayers');
    const activeTournament = await AsyncStorage.getItem('tournamentActive');
    const players: Player[] = savedPlayers ? JSON.parse(savedPlayers) : [];

    if (activeTournament === 'true' && players.length > 0) {
      Alert.alert(
        'Torneo Activo',
        'Hay un torneo en curso. ¿Deseas continuar o reiniciar?',
        [
          {
            text: 'Continuar',
            onPress: () => {
              setTournamentPlayers(players);
              setAvailablePlayers([]);
              router.replace('/screens/TournamentRounds');
            },
          },
          {
            text: 'Reiniciar',
            style: 'destructive',
            onPress: async () => {
              await AsyncStorage.removeItem('tournamentRounds');
              await AsyncStorage.removeItem('currentRoundIndex');
              await AsyncStorage.removeItem('tournamentPlayers');
              await AsyncStorage.setItem('tournamentActive', 'false');
              setAvailablePlayers(players);
              setTournamentPlayers([]);
            },
          },
        ],
        { cancelable: false }
      );
    } else {
      setAvailablePlayers(players);
      setTournamentPlayers([]);
    }
  };

  const savePlayers = async (players: Player[], active: boolean = false) => {
    await AsyncStorage.setItem('tournamentPlayers', JSON.stringify(players));
    await AsyncStorage.setItem('tournamentActive', active ? 'true' : 'false');
  };

  const addPlayerToAvailable = () => {
    if (!newPlayer.trim()) return;
    const player: Player = { id: Date.now().toString(), name: newPlayer.trim() };
    const updated = [...availablePlayers, player];
    setAvailablePlayers(updated);
    setNewPlayer('');
    savePlayers(updated, false);
  };

  const addToTournament = (player: Player) => {
    const updatedTournament = [...tournamentPlayers, player];
    const updatedAvailable = availablePlayers.filter(p => p.id !== player.id);
    setTournamentPlayers(updatedTournament);
    setAvailablePlayers(updatedAvailable);
    savePlayers(updatedTournament, true);
  };

  const removeFromTournament = (player: Player) => {
    const updatedTournament = tournamentPlayers.filter(p => p.id !== player.id);
    const updatedAvailable = [...availablePlayers, player];
    setTournamentPlayers(updatedTournament);
    setAvailablePlayers(updatedAvailable);
    savePlayers(updatedTournament, updatedTournament.length > 0);
  };

  const moveAllToTournament = () => {
    const updated = [...tournamentPlayers, ...availablePlayers];
    setTournamentPlayers(updated);
    setAvailablePlayers([]);
    savePlayers(updated, true);
  };

  const moveAllToAvailable = () => {
    const updated = [...availablePlayers, ...tournamentPlayers];
    setAvailablePlayers(updated);
    setTournamentPlayers([]);
    savePlayers([], false);
  };

  // 🔹 Validación para iniciar torneo
  const launchTournament = async () => {
    if (tournamentPlayers.length < 4) {
      Alert.alert('Error', 'Se necesitan al menos 4 jugadores para iniciar un torneo.');
      return;
    }

    if (tournamentPlayers.length % 2 !== 0) {
      Alert.alert('Error', 'El número de jugadores debe ser par para iniciar el torneo.');
      return;
    }

    // Eliminar rondas anteriores
    await AsyncStorage.removeItem('tournamentRounds');
    await AsyncStorage.removeItem('currentRoundIndex');

    await savePlayers(tournamentPlayers, true);
    router.push('/screens/TournamentRounds');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registro de Jugadores</Text>

      {/* Botón Comenzar Torneo arriba */}
      <TouchableOpacity style={styles.startButton} onPress={launchTournament}>
        <FontAwesome5 name="cat" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.startButtonText}>Comenzar Torneo</Text>
      </TouchableOpacity>

      {/* Input para agregar jugador */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Nombre del jugador"
          placeholderTextColor="#aaa"
          value={newPlayer}
          onChangeText={setNewPlayer}
          style={styles.input}
        />
        <TouchableOpacity onPress={addPlayerToAvailable} style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listsContainer}>
        {/* Jugadores Disponibles */}
        <View style={styles.listBox}>
          <Text style={styles.listTitle}>Disponibles</Text>

          <TouchableOpacity style={styles.moveButton} onPress={moveAllToTournament}>
            <MaterialIcons name="arrow-forward-ios" size={24} color="#fff" />
          </TouchableOpacity>

          <FlatList
            data={availablePlayers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => addToTournament(item)}>
                <Text style={styles.item}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Jugadores en Torneo */}
        <View style={styles.listBox}>
          <Text style={styles.listTitle}>En Torneo</Text>

          <TouchableOpacity style={styles.moveButton} onPress={moveAllToAvailable}>
            <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
          </TouchableOpacity>

          <FlatList
            data={tournamentPlayers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => removeFromTournament(item)}>
                <Text style={styles.item}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#121212' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#fff' },
  startButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E90FF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  startButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', marginBottom: 15 },
  input: { flex: 1, borderWidth: 1, borderColor: '#444', backgroundColor: '#1E1E1E', color: '#fff', padding: 10, borderRadius: 5 },
  addButton: { backgroundColor: '#32CD32', paddingHorizontal: 15, borderRadius: 5, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  listsContainer: { flexDirection: 'row', justifyContent: 'space-between', flex: 1 },
  listBox: { flex: 1, borderWidth: 1, borderColor: '#333', borderRadius: 5, padding: 10, marginHorizontal: 5, backgroundColor: '#1E1E1E' },
  listTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5, textAlign: 'center', color: '#fff' },
  moveButton: { alignSelf: 'center', marginBottom: 5, backgroundColor: '#FF6347', padding: 5, borderRadius: 5 },
  item: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#333', color: '#fff' },
});
