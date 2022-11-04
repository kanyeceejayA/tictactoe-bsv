import "./App.css";
import Game, { calculateWinner } from "./Game";
import React, { useState, useEffect } from "react";
import TitleBar, { GameStatus } from "./TitleBar";
import { PubKey } from "scryptlib";
import Balance from "./balance";
import {GameData, PlayerPublicKey, Player, ContractUtxos, CurrentPlayer} from "./storage";
import { SensiletWallet, web3 } from "./web3";
import Auth from "./auth";
import { Footer } from "./Footer";

async function fetchContract(alicePubKey, bobPubKey) {
  let { contractClass: TictactoeContractClass } = await web3.loadContract(
    "/tic-tac-toe/tictactoe_release_desc0.json"
  );

  return new TictactoeContractClass(
    new PubKey(alicePubKey),
    new PubKey(bobPubKey),
    true,
    [0,0,0,0,0,0,0,0,0]
  );
}


function App() {

  const ref = React.createRef();

  const [states, updateStates] = useState({
    gameStatus: GameStatus.wait,
    isConnected: false,
    instance: null
  });

  // init web3 wallet
  useEffect(async () => {

    const timer = setTimeout(async ()=> {

      const instance = await fetchContract(PlayerPublicKey.get(Player.Alice),
        PlayerPublicKey.get(Player.Bob))

      const wallet =  new SensiletWallet();
      web3.setWallet(wallet);
      const isConnected = await web3.wallet.isConnected();

      if(isConnected) {
        const n = await wallet.getNetwork();
        web3.setWallet(new SensiletWallet(n));
      } 


      updateStates(Object.assign({}, states, {
        isConnected: isConnected,
        instance: instance
      }))

      const gameState = GameData.get();

      if(Object.keys(GameData.get()).length > 0) {
        updateStates({
          gameStatus: gameState.status,
          isConnected: isConnected,
          instance: instance
        })

      } else {
        updateStates({
          gameStatus: GameStatus.wait,
          isConnected: isConnected,
          instance: instance
        })
      }

    }, 100)


    return () => {
      clearTimeout(timer)
    }

  }, []);

  const startGame = async (amount) => {

    if(web3.wallet && states.instance) {

      web3.deploy(states.instance, amount).then(rawTx => {


        let gameStates = {
          amount: amount,
          name: "tic-tac-toe",
          date: new Date(),
          history: [
            {
              squares: Array(9).fill(null),
            },
          ],
          currentStepNumber: 0,
          isAliceTurn: true,
          status: GameStatus.progress
        };

        ContractUtxos.add(rawTx);
        GameData.set(gameStates);
        CurrentPlayer.set(Player.Alice);

        updateStates(Object.assign({}, states, {
          gameStatus: GameStatus.progress
        }))

      })
      .catch(e => {
        alert(e.message)
        console.error(e)
      })
    }

    
    
  };

  const cancelGame = async () => {
    GameData.clear();
    ContractUtxos.clear();
    CurrentPlayer.set(Player.Alice);

    if(states.instance) {
      // reset states
      states.instance.isAliceTurn = true;
      states.instance.board = [0,0,0,0,0,0,0,0,0];
    }

    ref.current.clean();

    updateStates({
      gameStatus: GameStatus.wait,
      isConnected: states.isConnected,
      instance: states.instance
    })

  };

  const updateGameStatus = async () => {
    const gameState = GameData.get();
    if(Object.keys(GameData.get()).length > 0) {
      updateStates(Object.assign({}, states, {
        gameStatus: gameState.status
      }))
    } else {
      updateStates({
        gameStatus: GameStatus.wait
      })
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h2>Play Tic-Tac-Toe on Bitcoin</h2>
        <TitleBar
          onStart={startGame}
          onCancel={cancelGame}
          gameStatus={states.gameStatus}
        />
        <Game ref={ref} contractInstance={states.instance} updateGameStatus={updateGameStatus}/>
        {states.isConnected ? <Balance></Balance> : <Auth></Auth>}
      </header>
      <Footer />
    </div>
  );
}

export default App;
