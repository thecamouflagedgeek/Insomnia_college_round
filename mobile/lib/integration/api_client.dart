import 'package:dio/dio.dart';

/// A request the API refused. [reason] is the contract's `detail.reason` code (e.g. replay, bad_enroll_code,
/// case_not_found), or `network_error` / `server_error` when there is no body to read.
class ApiFailure implements Exception {
  ApiFailure(this.reason, [this.status]);
  final String reason;
  final int? status;
  @override
  String toString() => 'ApiFailure($status, $reason)';
}

typedef Json = Map<String, dynamic>;

/// Transport for shared/api-contract.yaml. Holds no credentials: case tokens and codes are passed per call.
class IncognitoApi {
  IncognitoApi(String baseUrl, {Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: baseUrl,
              connectTimeout: const Duration(seconds: 15),
              // Proof validation and enrolment wait for an Amoy transaction.
              receiveTimeout: const Duration(seconds: 90),
            ),
          );
  final Dio _dio;

  static Options _bearer(String token) => Options(headers: {'Authorization': 'Bearer $token'});

  Future<T> _call<T>(Future<Response<dynamic>> Function() send) async {
    try {
      return (await send()).data as T;
    } on DioException catch (e) {
      final data = e.response?.data;
      final detail = data is Map ? data['detail'] : null;
      final reason = detail is Map && detail['reason'] is String
          ? detail['reason'] as String
          : (e.response == null ? 'network_error' : 'server_error');
      throw ApiFailure(reason, e.response?.statusCode);
    }
  }

  Future<Json> health() => _call(() => _dio.get('/health'));
  Future<Json> categories() => _call(() => _dio.get('/categories'));
  Future<Json> classify(String text) => _call(() => _dio.post('/classify', data: {'text': text}));

  Future<Json> enroll(String commitment, String enrollCode) => _call(
    () => _dio.post(
      '/zk/enroll',
      data: {'commitment': commitment},
      options: Options(headers: {'X-Enroll-Code': enrollCode}),
    ),
  );
  Future<Json> group() => _call(() => _dio.get('/zk/group'));
  Future<Json> complaintScope() => _call(() => _dio.get('/zk/scopes/complaint'));
  Future<Json> challengeScope(String caseId, String memberId) => _call(
    () => _dio.get('/zk/scopes/challenge', queryParameters: {'case_id': caseId, 'member_id': memberId}),
  );

  Future<Json> submitReport(String payload, Json proof) =>
      _call(() => _dio.post('/reports', data: {'payload': payload, 'proof': proof}));
  Future<Json> report(String caseId, String token) =>
      _call(() => _dio.get('/reports/${Uri.encodeComponent(caseId)}', options: _bearer(token)));
  Future<Json> uploadEvidence(String caseId, String token, String path, String name) async => _call(
    () async => _dio.post(
      '/reports/${Uri.encodeComponent(caseId)}/evidence',
      data: FormData.fromMap({'file': await MultipartFile.fromFile(path, filename: name)}),
      options: _bearer(token),
    ),
  );
  Future<Json> challenge(String caseId, String token, String payload, Json proof) => _call(
    () => _dio.post(
      '/reports/${Uri.encodeComponent(caseId)}/challenge',
      data: {'payload': payload, 'proof': proof},
      options: _bearer(token),
    ),
  );
  Future<List<dynamic>> messages(String caseId, String token) =>
      _call(() => _dio.get('/reports/${Uri.encodeComponent(caseId)}/messages', options: _bearer(token)));
  Future<Json> sendMessage(String caseId, String token, String text) => _call(
    () => _dio.post(
      '/reports/${Uri.encodeComponent(caseId)}/messages',
      data: {'text': text},
      options: _bearer(token),
    ),
  );

  Future<List<dynamic>> invitations(String witnessCode) => _call(
    () => _dio.get('/witness-invitations', options: Options(headers: {'X-Witness-Code': witnessCode})),
  );
  Future<Json> respond(String witnessCode, String invitationId, String response) => _call(
    () => _dio.post(
      '/witness-invitations/${Uri.encodeComponent(invitationId)}/respond',
      data: {'response': response},
      options: Options(headers: {'X-Witness-Code': witnessCode}),
    ),
  );

  Future<Json> verify(String caseId, String token) =>
      _call(() => _dio.get('/audit/cases/${Uri.encodeComponent(caseId)}/verify', options: _bearer(token)));
  Future<List<dynamic>> receipts(String caseId, String token) =>
      _call(() => _dio.get('/audit/cases/${Uri.encodeComponent(caseId)}/receipts', options: _bearer(token)));
}
