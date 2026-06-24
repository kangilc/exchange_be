package exchange.admin.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.RawTransaction;
import org.web3j.crypto.TransactionEncoder;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.*;
import org.web3j.protocol.http.HttpService;
import org.web3j.utils.Numeric;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.Arrays;
import java.util.List;

/**
 * 로컬 이더리움 테스트넷(Ganache)과 연동하여 ERC-20 표준 JAF 토큰의 배포, 잔고 조회, 온체인 이체 트랜잭션 발송 등을 담당하는 서비스 클래스입니다.
 */
@Slf4j
@Service
public class JAFTokenService {

    @Value("${ethereum.rpc-url}")
    private String defaultRpcUrl;

    @Value("${ethereum.rpc-url-docker}")
    private String dockerRpcUrl;

    @Value("${ethereum.private-key}")
    private String privateKey;

    private Web3j web3j;
    private Credentials credentials;
    private String contractAddress;
    private boolean initialized = false;

    // JAFToken Solidity compiled bytecode
    private static final String BYTECODE = "60806040526040518060400160405280600581526020017f4a617661460000000000000000000000000000000000000000000000000000008152505f908162000049919062000429565b506040518060400160405280600381526020017f4a414600000000000000000000000000000000000000000000000000000000008152506001908162000090919062000429565b50601260025f6101000a81548160ff021916908360ff160217905550348015620000b8575f80fd5b506040516200153c3803806200153c8339818101604052810190620000de919062000540565b60025f9054906101000a900460ff1660ff16600a620000fe9190620006ed565b816200010b91906200073d565b60038190555060035460045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055503373ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef600354604051620001b6919062000798565b60405180910390a350620007b3565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806200024157607f821691505b602082108103620002575762000256620001fc565b5b50919050565b5f819050815f5260205f20905b81548152906001019060200180831161026357829003601f168201915b505050505081565b5f8160055f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516103639190610a7f565b60405180910390a36001905092915050565b60035481565b5f8160045f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205410156103fc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016103f390610c2c565b60405180910390fd5b8160055f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205410156104b7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104ae90610c94565b60405180910390fd5b8160045f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546105039190610cdf565b925050819055508160045f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546105569190610d12565b925050819055508160055f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546105e49190610cdf565b925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516106489190610a7f565b60405180910390a3600190509392505050565b60025f9054906101000a900460ff1681565b6004602052805f5260405f205f915090505481565b6001805461068f90610bb2565b80601f01602080910402602001604051908101604052809291908181526020018280546106bb90610bb2565b80156107065780601f106106dd57610100808354040283529160200191610706565b820191905f5260205f20905b8154815290600101906020018083116106e957829003601f168201915b505050505081565b5f8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054101561078f576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078690610c2c565b60405180910390fd5b8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8282546107db9190610cdf565b925050819055508160045f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825461082e9190610d12565b925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516108929190610a7f565b60405180910390a36001905092915050565b6005602052815f5260405f20602052805f5260405f205f91509150505481565b5f81519050919050565b5f82825260208201905092915050565b5f5b838110156108fb5780820151818401526020810190506108e0565b5f8484015250505050565b5f601f19601f8301169050919050565b5f610920826108c4565b61092a81856108ce565b935061093a8185602086016108de565b61094381610906565b840191505092915050565b5f6020820190508181035f8301526109668184610916565b905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61099b82610972565b9050919050565b6109ab81610991565b81146109b5575f80fd5b50565b5f813590506109c6816109a2565b92915050565b5f819050919050565b6109de816109cc565b81146109e8575f80fd5b50565b5f813590506109f9816109d5565b92915050565b5f8060408385031215610a1557610a1461096e565b5b5f610a22858286016109b8565b9250506020610a33858286016109eb565b9150509250929050565b5f8115159050919050565b610a5181610a3d565b82525050565b5f602082019050610a6a5f830184610a48565b92915050565b610a79816109cc565b82525050565b5f602082019050610a925f830184610a70565b92915050565b5f805f60608486031215610aaf57610aae61096e565b5b5f610abc868287016109b8565b9350506020610acd868287016109b8565b9250506040610ade868287016109eb565b9150509250925092565b5f60ff82169050919050565b610afd81610ae8565b82525050565b5f602082019050610b165f830184610af4565b92915050565b5f60208284031215610b3157610b3061096e565b5b5f610b3e848285016109b8565b91505092915050565b5f8060408385031215610b5d57610b5c61096e565b5b5f610b6a858286016109b8565b9250506020610b7b858286016109b8565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f6002820490506001821680610bc957607f821691505b602082108103610bdc57610bdb610b85565b5b50919050565b7f496e73756666696369656e742062616c616e63650000000000000000000000005f82015250565b5f610c166014836108ce565b9150610c2182610be2565b602082019050919050565b5f6020820190508181035f830152610c4381610c0a565b9050919050565b7f496e73756666696369656e7420616c6c6f77616e6365000000000000000000005f82015250565b5f610c7e6016836108ce565b9150610c8982610c4a565b602082019050919050565b5f6020820190508181035f830152610cab81610c72565b9050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610ce9826109cc565b9150610cf4836109cc565b9250828203905081811115610d0c57610d0b610cb2565b5b92915050565b5f610d1c826109cc565b9150610d27836109cc565b9250828201905080821115610d3f57610d3e610cb2565b5b9291505056fea26469706673582212204c81deb931fc02f242bf9f8453a8b391fbea3b935ada585a1ba009993966eb8864736f6c63430008140033";

    @PostConstruct
    public void init() {
        // Connect to Ganache and deploy JAFToken
        new Thread(() -> {
            int retries = 10;
            while (retries > 0) {
                try {
                    log.info("[JAFTokenService] 로컬 EVM 노드 연결을 시도합니다... (남은 횟수: {})", retries);
                    String rpcUrl = dockerRpcUrl;
                    try {
                        web3j = Web3j.build(new HttpService(rpcUrl));
                        // 기본 버전 조회로 연결 여부 테스트
                        web3j.web3ClientVersion().send();
                        log.info("[JAFTokenService] Ganache 컨테이너 연결 성공! ({})", rpcUrl);
                    } catch (Exception e) {
                        rpcUrl = defaultRpcUrl;
                        web3j = Web3j.build(new HttpService(rpcUrl));
                        web3j.web3ClientVersion().send();
                        log.info("[JAFTokenService] Ganache 로컬 호스트 연결 성공! ({})", rpcUrl);
                    }

                    // Ganache 0번 계정 Credentials 로드 (설정 파일의 private-key 주입)
                    credentials = Credentials.create(privateKey);

                    // JAF ERC-20 스마트 컨트랙트 배포 진행 (초기 공급량: 1억 JAF)
                    deployJafContract();
                    initialized = true;
                    break;
                } catch (Exception e) {
                    log.error("[JAFTokenService] 연결 또는 배포 실패: {}. 3초 후 재시도...", e.getMessage());
                    retries--;
                    try {
                        Thread.sleep(3000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                }
            }

            if (!initialized) {
                log.warn("[JAFTokenService] 경고: Ganache EVM 노드 연결 실패. JAF 토큰 기능은 Mock 시뮬레이션으로 대체 작동될 수 있습니다.");
            }
        }).start();
    }

    private void deployJafContract() throws Exception {
        log.info("[JAFTokenService] JAF ERC-20 토큰 컨트랙트 배포 중...");

        EthGetTransactionCount ethGetTransactionCount = web3j.ethGetTransactionCount(
                credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
        BigInteger nonce = ethGetTransactionCount.getTransactionCount();

        // 생성자 파라미터 (1억 JAF 토큰 공급량) 인코딩
        BigInteger initialSupply = new BigInteger("100000000"); // 100,000,000
        String encodedParam = Numeric.toHexStringNoPrefixZeroPadded(initialSupply, 64);
        String deployData = BYTECODE + encodedParam;

        BigInteger gasPrice = BigInteger.valueOf(20000000000L); // 20 Gwei
        BigInteger gasLimit = BigInteger.valueOf(3000000L);

        RawTransaction rawTransaction = RawTransaction.createContractTransaction(
                nonce, gasPrice, gasLimit, BigInteger.ZERO, deployData);

        byte[] signedMessage = TransactionEncoder.signMessage(rawTransaction, credentials);
        String hexValue = Numeric.toHexString(signedMessage);

        EthSendTransaction ethSendTransaction = web3j.ethSendRawTransaction(hexValue).send();
        if (ethSendTransaction.hasError()) {
            throw new RuntimeException("Deployment transaction failed: " + ethSendTransaction.getError().getMessage());
        }

        String txHash = ethSendTransaction.getTransactionHash();
        log.info("[JAFTokenService] 배포 트랜잭션 전송 완료. TXID: {}", txHash);

        // 영수증 수신 대기 (최대 10초)
        TransactionReceipt receipt = null;
        for (int i = 0; i < 20; i++) {
            Thread.sleep(500);
            EthGetTransactionReceipt ethGetTransactionReceipt = web3j.ethGetTransactionReceipt(txHash).send();
            if (ethGetTransactionReceipt.getTransactionReceipt().isPresent()) {
                receipt = ethGetTransactionReceipt.getTransactionReceipt().get();
                break;
            }
        }

        if (receipt == null) {
            throw new RuntimeException("Failed to get contract deployment receipt.");
        }

        contractAddress = receipt.getContractAddress();
        log.info("[JAFTokenService] JAF ERC-20 토큰 계약 배포 성공! CA: {}", contractAddress);
        log.info("[JAFTokenService] 초기 1억 JAF 토큰이 핫월렛 계정({})으로 민팅되었습니다.", credentials.getAddress());
    }

    public boolean isInitialized() {
        return initialized;
    }

    public String getContractAddress() {
        return contractAddress;
    }

    public Web3j getWeb3j() {
        return web3j;
    }

    public BigDecimal getBalance(String address) {
        if (!initialized || contractAddress == null) {
            return BigDecimal.ZERO;
        }

        try {
            Function function = new Function(
                    "balanceOf",
                    Arrays.asList(new Address(address)),
                    Arrays.asList(new TypeReference<Uint256>() {
                    }));
            String encodedFunction = FunctionEncoder.encode(function);

            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, contractAddress, encodedFunction),
                    DefaultBlockParameterName.LATEST).send();

            if (response.getValue() == null || "0x".equals(response.getValue())) {
                return BigDecimal.ZERO;
            }

            List<Type> values = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (values.isEmpty()) {
                return BigDecimal.ZERO;
            }
            BigInteger rawBalance = (BigInteger) values.get(0).getValue();
            return new BigDecimal(rawBalance).divide(BigDecimal.TEN.pow(18), 8, RoundingMode.HALF_UP);
        } catch (Exception e) {
            log.error("[JAFTokenService] 잔고 조회 실패 ({}): {}", address, e.getMessage());
            return BigDecimal.ZERO;
        }
    }

    public String transfer(String toAddress, BigDecimal amount) throws Exception {
        if (!initialized || contractAddress == null) {
            throw new IllegalStateException("JAFTokenService is not initialized or contract not deployed.");
        }

        log.info("[JAFTokenService] JAF 송금 요청: {} JAF -> {}", amount, toAddress);
        BigInteger rawAmount = amount.multiply(BigDecimal.TEN.pow(18)).toBigInteger();

        Function function = new Function(
                "transfer",
                Arrays.asList(new Address(toAddress), new Uint256(rawAmount)),
                Arrays.asList(new TypeReference<Bool>() {
                }));
        String encodedFunction = FunctionEncoder.encode(function);

        EthGetTransactionCount ethGetTransactionCount = web3j.ethGetTransactionCount(
                credentials.getAddress(), DefaultBlockParameterName.LATEST).send();
        BigInteger nonce = ethGetTransactionCount.getTransactionCount();

        BigInteger gasPrice = BigInteger.valueOf(20000000000L); // 20 Gwei
        BigInteger gasLimit = BigInteger.valueOf(100000L); // Transfer gas limit

        RawTransaction rawTransaction = RawTransaction.createTransaction(
                nonce, gasPrice, gasLimit, contractAddress, encodedFunction);

        byte[] signedMessage = TransactionEncoder.signMessage(rawTransaction, credentials);
        String hexValue = Numeric.toHexString(signedMessage);

        EthSendTransaction ethSendTransaction = web3j.ethSendRawTransaction(hexValue).send();
        if (ethSendTransaction.hasError()) {
            throw new RuntimeException(
                    "JAF transfer transaction failed: " + ethSendTransaction.getError().getMessage());
        }

        String txHash = ethSendTransaction.getTransactionHash();
        log.info("[JAFTokenService] JAF 송금 트랜잭션 브로드캐스트 성공. TXID: {}", txHash);
        return txHash;
    }
}
